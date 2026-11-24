const tokenInput = document.getElementById("token");
const resultEl = document.getElementById("result");

function showResult(text, kind) {
  resultEl.textContent = text;
  resultEl.className = kind;
}

async function testToken(token) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ viewer { login } }" }),
  });
  if (response.status === 401) throw new Error("GitHub rejected this token.");
  if (!response.ok) throw new Error(`GitHub answered with HTTP ${response.status}.`);
  const json = await response.json();
  const login = json.data?.viewer?.login;
  if (!login) throw new Error("GitHub did not return a user for this token.");
  return login;
}

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showResult("Paste a token first.", "err");
    return;
  }
  showResult("Testing…", "");
  try {
    const login = await testToken(token);
    await chrome.storage.local.set({ githubToken: token });
    tokenInput.value = "";
    showResult(`Saved. Connected as @${login}. Reload Gmail to see PR status.`, "ok");
  } catch (err) {
    showResult(`${err.message} Nothing was saved.`, "err");
  }
});

document.getElementById("remove").addEventListener("click", async () => {
  await chrome.storage.local.remove("githubToken");
  showResult("Token removed.", "ok");
});

(async () => {
  const { githubToken } = await chrome.storage.local.get("githubToken");
  if (githubToken) {
    tokenInput.placeholder = "A token is saved. Paste a new one to replace it.";
  }
})();
