// Background service worker.
// - Relays toolbar clicks and keyboard shortcuts to the Gmail content script.
// - Fetches PR status from the GitHub GraphQL API (the token never reaches Gmail's page).

const GMAIL_ORIGIN = "https://mail.google.com/";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const CACHE_TTL_MS = 60 * 1000;

/** @type {Map<string, {at: number, result: object}>} */
const cache = new Map();

const PR_STATUS_QUERY = `
  query ($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        url
        state
        isDraft
        reviewDecision
        commits(last: 1) {
          nodes { commit { statusCheckRollup { state } } }
        }
      }
    }
  }
`;

// ---- Toolbar / shortcut -------------------------------------------------

async function sendToGmail(tab, type) {
  if (!tab?.id || !tab.url?.startsWith(GMAIL_ORIGIN)) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch (err) {
    console.warn("[gh-pr-threads] Could not reach Gmail tab. Reload it.", err);
  }
}

const COMMAND_MESSAGES = {
  "find-pr-emails": "FIND_PR_EMAILS",
  "delete-pr-emails": "DELETE_PR_EMAILS",
};

chrome.action.onClicked.addListener((tab) => sendToGmail(tab, "FIND_PR_EMAILS"));

chrome.commands.onCommand.addListener(async (command, tab) => {
  const type = COMMAND_MESSAGES[command];
  if (!type) return;
  const target =
    tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  sendToGmail(target, type);
});

// ---- GitHub -------------------------------------------------------------

async function getToken() {
  const { githubToken } = await chrome.storage.local.get("githubToken");
  return githubToken || null;
}

function classifyGraphqlErrors(errors) {
  const text = errors.map((e) => `${e.type ?? ""} ${e.message ?? ""}`).join(" ");
  if (/SAML|SSO/i.test(text)) return "SSO_REQUIRED";
  if (/NOT_FOUND|Could not resolve/i.test(text)) return "NOT_FOUND";
  if (/FORBIDDEN|Resource not accessible/i.test(text)) return "NOT_FOUND";
  return "UNKNOWN";
}

/**
 * @returns {Promise<{ok: true, status: object} | {ok: false, error: string}>}
 */
async function fetchPrStatus(repo, number) {
  const token = await getToken();
  if (!token) return { ok: false, error: "NO_TOKEN" };

  const [owner, name] = repo.split("/");
  let response;
  try {
    response = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: PR_STATUS_QUERY,
        variables: { owner, name, number: Number(number) },
      }),
    });
  } catch {
    return { ok: false, error: "NETWORK" };
  }

  if (response.status === 401) return { ok: false, error: "BAD_TOKEN" };
  if (response.status === 403) {
    const sso = response.headers.get("x-github-sso");
    return { ok: false, error: sso ? "SSO_REQUIRED" : "NOT_FOUND" };
  }
  if (!response.ok) return { ok: false, error: "UNKNOWN" };

  const json = await response.json();
  const pr = json.data?.repository?.pullRequest;
  if (!pr) {
    return { ok: false, error: json.errors ? classifyGraphqlErrors(json.errors) : "NOT_FOUND" };
  }

  const rollup = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup;
  return {
    ok: true,
    status: {
      url: pr.url,
      // OPEN | DRAFT | MERGED | CLOSED
      state: pr.state === "OPEN" && pr.isDraft ? "DRAFT" : pr.state,
      // APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | null
      reviewDecision: pr.reviewDecision,
      // SUCCESS | FAILURE | ERROR | PENDING | EXPECTED | null
      checks: rollup?.state ?? null,
    },
  };
}

async function getPrStatus(repo, number, { fresh = false } = {}) {
  const key = `${repo}#${number}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const result = await fetchPrStatus(repo, number);
  // Cache successes only, so fixing a token takes effect right away.
  if (result.ok) cache.set(key, { at: Date.now(), result });
  return result;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "githubToken" in changes) cache.clear();
});

// ---- Messages from content script / options page -------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_PR_STATUS") {
    getPrStatus(message.repo, message.number, { fresh: message.fresh })
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "UNKNOWN" }));
    return true; // keep the channel open for the async response
  }
  if (message?.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
  }
  return false;
});
