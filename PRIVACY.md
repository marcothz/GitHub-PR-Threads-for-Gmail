# Privacy Policy

_Last updated: November 24, 2026_

GitHub PR Threads for Gmail ("the extension") is a Chrome extension that adds
pull request status and cleanup buttons to GitHub notification emails in
Gmail. This policy explains what data it uses and why.

## What the extension reads

- **Gmail page content.** On `mail.google.com`, the extension reads the
  subject of the email you have open. When you use **Delete all**, it also
  reads the visible text of each row in the search results (sender, subject
  and Gmail's preview snippet) to check that the row is about the same
  repository and pull request before selecting it. This text is used only to
  recognise GitHub notifications and extract the repository name and pull
  request number (for example `[owner/repo] … (PR #85)`). It is never stored
  or sent anywhere. The extension does not open email bodies, attachments,
  contacts or any other mailbox data.

## What the extension stores

- **Your GitHub personal access token.** You enter it on the options page.
  It is stored with `chrome.storage.local` on your own device only. It is not
  synced to your Google account and never sent anywhere except GitHub. You
  can delete it at any time with the **Remove** button on the options page or
  by uninstalling the extension.
- **A short-lived status cache.** Pull request status results are kept in
  memory for up to 60 seconds to avoid repeated requests. They are discarded
  when the browser closes the extension's background worker.

## What the extension sends, and to whom

- **GitHub only.** To show pull request status, the extension sends the
  repository owner, repository name and pull request number to the GitHub
  GraphQL API (`https://api.github.com/graphql`), authenticated with your
  token. When you save a token, it also asks GitHub for the login of the
  token's owner to confirm the token works.
- Nothing else is sent anywhere. The extension has no servers of its own, no
  analytics, no tracking, no advertising and no third-party code.

## Actions in Gmail

The **Find all** and **Delete all** actions run a Gmail search and, for
**Delete all**, select the matching rows and click Gmail's own Delete button
after you confirm. Deleted emails go to Gmail's Trash, where Gmail keeps them
for 30 days. These actions happen inside your Gmail tab; no email data leaves
your browser.

## Limited Use

The use of information received from Gmail by this extension adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Data is used only to provide the
features described above. It is not sold, not transferred to third parties,
not used for advertising and not used to determine creditworthiness or for
lending purposes. No human reads your data.

## Changes

If this policy changes, the new version will be published at this address
with an updated date.

## Contact

Questions or requests: open an issue at
<https://github.com/marcothz/GitHub-PR-Threads-for-Gmail/issues>.
