// Runs inside Gmail. Reads the open email's subject, extracts the GitHub
// repository and PR number, shows the PR status, and lets you search for or
// trash every email about the same PR.

(() => {
  "use strict";

  const BAR_CLASS = "ghpr-bar";
  const TOAST_ID = "ghpr-toast";
  const DIALOG_ID = "ghpr-dialog";

  // Matches GitHub notification subjects such as:
  //   "Re: [GetAmbush/utility-belt] feat(...): Some title (UTI-131) (PR #473)"
  const SUBJECT_RE = /\[([\w.-]+\/[\w.-]+)\].*\(PR #(\d+)\)/;

  // Matches the search this extension runs, so shortcuts also work on the
  // search results page (where no email is open).
  const SEARCH_HASH_RE =
    /^#search\/from:notifications@github\.com subject:"\[([\w.-]+\/[\w.-]+)\]" subject:"PR #(\d+)"/;

  // Gmail's own markup. These are not public APIs: if Gmail changes them,
  // this is the place to update.
  const GMAIL = {
    subject: "h2.hP",
    main: 'div[role="main"]',
    listRow: "tr.zA",
    rowCheckbox: '[role="checkbox"]',
    toolbar: '[gh="tm"]',
    deleteButton: '[act="10"]',
  };

  const STATE_LABELS = {
    OPEN: { text: "Open", tone: "open" },
    DRAFT: { text: "Draft", tone: "draft" },
    MERGED: { text: "Merged", tone: "merged" },
    CLOSED: { text: "Closed", tone: "closed" },
  };

  const REVIEW_LABELS = {
    APPROVED: { text: "Approved", tone: "good" },
    CHANGES_REQUESTED: { text: "Changes requested", tone: "bad" },
    REVIEW_REQUIRED: { text: "Review required", tone: "wait" },
  };

  const CHECK_LABELS = {
    SUCCESS: { text: "Checks passing", tone: "good" },
    FAILURE: { text: "Checks failing", tone: "bad" },
    ERROR: { text: "Checks failing", tone: "bad" },
    PENDING: { text: "Checks running", tone: "wait" },
    EXPECTED: { text: "Checks running", tone: "wait" },
  };

  const ERROR_MESSAGES = {
    NO_TOKEN: { text: "Connect GitHub to see the PR status", action: "options" },
    BAD_TOKEN: { text: "GitHub token is invalid. Update it", action: "options" },
    SSO_REQUIRED: { text: "Authorize your token for this organization's SSO", action: "options" },
    NOT_FOUND: { text: "No access to this PR with your token", action: "options" },
    NETWORK: { text: "Could not reach GitHub. Retry", action: "retry" },
    UNKNOWN: { text: "Could not load the PR status. Retry", action: "retry" },
  };

  // ---- Helpers ------------------------------------------------------------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isVisible = (el) => Boolean(el && el.offsetParent !== null);
  const firstVisible = (selector, root = document) =>
    [...root.querySelectorAll(selector)].find(isVisible) ?? null;

  // Gmail reacts to mousedown/mouseup, not only to click.
  function simulateClick(el) {
    for (const type of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  // ---- Parsing & search ---------------------------------------------------

  /** @returns {{repo: string, number: string} | null} */
  function parseSubject(subject) {
    const match = subject?.match(SUBJECT_RE);
    return match ? { repo: match[1], number: match[2] } : null;
  }

  function parseSearchHash() {
    const decoded = decodeURIComponent(window.location.hash.replace(/\+/g, " "));
    const match = decoded.match(SEARCH_HASH_RE);
    return match ? { repo: match[1], number: match[2] } : null;
  }

  // The PR of the open email, or of this extension's search results page.
  function getCurrentPr() {
    const subjectEl = firstVisible(GMAIL.subject);
    if (subjectEl) return parseSubject(subjectEl.textContent);
    return parseSearchHash();
  }

  function buildQuery({ repo, number }) {
    return [
      "from:notifications@github.com",
      `subject:"[${repo}]"`,
      `subject:"PR #${number}"`,
    ].join(" ");
  }

  function runSearch(query) {
    const encoded = encodeURIComponent(query).replace(/%20/g, "+");
    window.location.hash = `#search/${encoded}`;
  }

  function showToast(message) {
    document.getElementById(TOAST_ID)?.remove();
    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function findPrEmails() {
    const pr = getCurrentPr();
    if (!pr) {
      showToast("Open a GitHub PR notification first.");
      return;
    }
    runSearch(buildQuery(pr));
  }

  // ---- Delete all ---------------------------------------------------------

  function visibleRows() {
    const main = firstVisible(GMAIL.main);
    return main ? [...main.querySelectorAll(GMAIL.listRow)].filter(isVisible) : [];
  }

  // Waits until the results list stops changing, so we never act on the
  // view that was on screen before the search.
  async function waitForResults({ minWaitMs = 1000, timeoutMs = 10000 } = {}) {
    const start = Date.now();
    let lastSignature = null;
    let stableTicks = 0;

    while (Date.now() - start < timeoutMs) {
      await sleep(250);
      const rows = visibleRows();
      const signature = `${rows.length}|${rows[0]?.innerText.slice(0, 80) ?? ""}`;
      stableTicks = signature === lastSignature ? stableTicks + 1 : 0;
      lastSignature = signature;
      if (Date.now() - start >= minWaitMs && stableTicks >= 3) return rows;
    }
    return visibleRows();
  }

  // Double check on top of the search: only rows whose subject names this
  // repository and PR are ever selected.
  function rowMatchesPr(row, pr) {
    const text = row.innerText;
    return text.includes(`[${pr.repo}]`) && text.includes(`PR #${pr.number}`);
  }

  function setChecked(row, checked) {
    const box = row.querySelector(GMAIL.rowCheckbox);
    if (!box) return false;
    const isChecked = box.getAttribute("aria-checked") === "true";
    if (isChecked !== checked) simulateClick(box);
    return true;
  }

  function confirmDelete({ pr, count, skipped }) {
    return new Promise((resolve) => {
      document.getElementById(DIALOG_ID)?.remove();

      const backdrop = document.createElement("div");
      backdrop.id = DIALOG_ID;

      const dialog = document.createElement("div");
      dialog.className = "ghpr-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "ghpr-dialog-title");

      const title = document.createElement("h2");
      title.id = "ghpr-dialog-title";
      title.textContent = `Move ${plural(count, "conversation")} to Trash?`;

      const body = document.createElement("p");
      body.textContent =
        `All emails about ${pr.repo} PR #${pr.number} on this page. ` +
        "You can undo right after, and Gmail keeps them in Trash for 30 days.";

      const children = [title, body];
      if (skipped > 0) {
        const note = document.createElement("p");
        note.textContent = `${plural(skipped, "other result")} on this page will be left alone.`;
        children.push(note);
      }

      const actions = document.createElement("div");
      actions.className = "ghpr-dialog-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "ghpr-dialog-cancel";
      cancel.textContent = "Cancel";
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "ghpr-dialog-confirm";
      confirm.textContent = "Move to Trash";
      actions.append(cancel, confirm);
      children.push(actions);

      dialog.append(...children);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      const close = (result) => {
        backdrop.remove();
        resolve(result);
      };
      cancel.addEventListener("click", () => close(false));
      confirm.addEventListener("click", () => close(true));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) close(false);
      });
      // Keep Gmail's keyboard shortcuts from firing while the dialog is open.
      backdrop.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Escape") close(false);
      });
      confirm.focus();
    });
  }

  let deleting = false;

  async function deletePrEmails(pr = getCurrentPr()) {
    if (deleting) return;
    if (!pr) {
      showToast("Open a GitHub PR notification first.");
      return;
    }
    deleting = true;
    try {
      showToast(`Finding emails for PR #${pr.number}…`);
      runSearch(buildQuery(pr));
      const rows = await waitForResults();
      document.getElementById(TOAST_ID)?.remove();

      const matching = rows.filter((row) => rowMatchesPr(row, pr));
      const others = rows.filter((row) => !rowMatchesPr(row, pr));
      if (matching.length === 0) {
        showToast(`No emails found for PR #${pr.number}.`);
        return;
      }

      const confirmed = await confirmDelete({
        pr,
        count: matching.length,
        skipped: others.length,
      });
      if (!confirmed) return;

      others.forEach((row) => setChecked(row, false));
      for (const row of matching) {
        if (!setChecked(row, true)) {
          showToast("Could not select the emails. Gmail's layout may have changed.");
          return;
        }
        await sleep(30);
      }
      await sleep(250);

      const toolbar = firstVisible(GMAIL.toolbar);
      const deleteButton = toolbar && firstVisible(GMAIL.deleteButton, toolbar);
      if (!deleteButton) {
        showToast("Could not find Gmail's Delete button. Delete the selected emails yourself.");
        return;
      }
      // Gmail shows its own "moved to Trash" message with Undo.
      simulateClick(deleteButton);
    } finally {
      deleting = false;
    }
  }

  // ---- Status rendering ---------------------------------------------------

  function chip({ text, tone }, href) {
    const el = document.createElement(href ? "a" : "span");
    el.className = `ghpr-chip ghpr-chip--${tone}`;
    el.textContent = text;
    if (href) {
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      el.title = "Open this PR on GitHub";
    }
    return el;
  }

  function renderLoading(statusEl) {
    const note = document.createElement("span");
    note.className = "ghpr-note";
    note.textContent = "Loading PR status…";
    statusEl.replaceChildren(note);
  }

  function renderError(statusEl, errorCode, pr) {
    const { text, action } = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.UNKNOWN;
    const link = document.createElement("button");
    link.type = "button";
    link.className = "ghpr-link";
    link.textContent = text;
    link.addEventListener("click", (event) => {
      event.stopPropagation();
      if (action === "options") chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
      else loadStatus(statusEl, pr, { fresh: true });
    });
    statusEl.replaceChildren(link);
  }

  function renderStatus(statusEl, status) {
    const chips = [chip(STATE_LABELS[status.state] ?? STATE_LABELS.OPEN, status.url)];

    // Review and checks only matter while the PR is still open.
    if (status.state === "OPEN" || status.state === "DRAFT") {
      const review = REVIEW_LABELS[status.reviewDecision];
      if (review) chips.push(chip(review));
      const checks = CHECK_LABELS[status.checks];
      if (checks) chips.push(chip(checks));
    }
    statusEl.replaceChildren(...chips);
  }

  async function loadStatus(statusEl, pr, { fresh = false } = {}) {
    const key = `${pr.repo}#${pr.number}`;
    renderLoading(statusEl);

    let result;
    try {
      result = await chrome.runtime.sendMessage({
        type: "GET_PR_STATUS",
        repo: pr.repo,
        number: pr.number,
        fresh,
      });
    } catch {
      result = { ok: false, error: "UNKNOWN" };
    }

    // The user may have moved to another email while we were waiting.
    if (!statusEl.isConnected || statusEl.dataset.prKey !== key) return;

    if (result?.ok) renderStatus(statusEl, result.status);
    else renderError(statusEl, result?.error, pr);
  }

  // ---- Injection ----------------------------------------------------------

  function barButton(text, className, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.title = title;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  // Adds a bar under the subject: PR status chips + actions.
  function injectBar() {
    const subjectEl = firstVisible(GMAIL.subject);
    if (!subjectEl) return;

    const pr = parseSubject(subjectEl.textContent);
    const container = subjectEl.parentElement;
    const existing = container.querySelector(`.${BAR_CLASS}`);

    if (!pr) {
      existing?.remove();
      return;
    }
    const key = `${pr.repo}#${pr.number}`;
    if (existing?.dataset.prKey === key) return;
    existing?.remove();

    const bar = document.createElement("div");
    bar.className = BAR_CLASS;
    bar.dataset.prKey = key;

    const statusEl = document.createElement("span");
    statusEl.className = "ghpr-status";
    statusEl.dataset.prKey = key;

    const findButton = barButton(
      `Find all for PR #${pr.number}`,
      "ghpr-btn",
      `Search Gmail for every notification about ${pr.repo} PR #${pr.number} (Alt+Shift+P)`,
      () => runSearch(buildQuery(pr))
    );
    const deleteButton = barButton(
      `Delete all for PR #${pr.number}`,
      "ghpr-btn ghpr-btn--danger",
      `Move every notification about ${pr.repo} PR #${pr.number} to Trash (Alt+Shift+D)`,
      () => deletePrEmails(pr)
    );

    bar.append(statusEl, findButton, deleteButton);
    subjectEl.insertAdjacentElement("afterend", bar);
    loadStatus(statusEl, pr);
  }

  // Gmail is a single-page app: watch the DOM and re-check after changes.
  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      injectBar();
    }, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  injectBar();

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "FIND_PR_EMAILS") findPrEmails();
    if (message?.type === "DELETE_PR_EMAILS") deletePrEmails();
  });
})();
