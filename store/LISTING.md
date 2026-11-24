# Chrome Web Store listing

Copy these into the Developer Dashboard. Field names follow the dashboard's
tabs.

## Store listing tab

**Name** (from the manifest)

> GitHub PR Threads for Gmail

**Summary** (from the manifest, max 132 characters)

> Find, review the status of and clean up every GitHub notification email about the same pull request.

**Category**

> Productivity → Developer Tools (or Workflow & Planning)

**Language**

> English

**Description**

```text
GitHub sends a separate email for every review, comment, push and CI run on a pull request. This extension groups them for you, right inside Gmail.

PR STATUS UNDER THE SUBJECT
Open any GitHub notification and see the pull request's state (Open, Draft, Merged, Closed), its review decision (Approved, Changes requested, Review required) and its CI checks (passing, failing, running). The state links straight to the pull request on GitHub.

FIND ALL FOR THE PR
One click, the toolbar icon or Alt+Shift+P lists every notification about the same repository and pull request.

DELETE ALL FOR THE PR
Done with a pull request? Alt+Shift+D finds its notifications, selects only the ones that match the repository and PR number, asks you to confirm and moves them to Gmail's Trash. Gmail keeps them for 30 days, so nothing is lost by mistake.

PRIVATE BY DESIGN
• Your GitHub token stays on your device and is only ever sent to GitHub.
• Only the repository and PR number are sent to GitHub, to fetch the status.
• No servers, no analytics, no tracking.

SETUP
1. Open the extension's options and save a GitHub personal access token (fine-grained: read-only Pull requests, Commit statuses and Contents; classic: repo).
2. Reload Gmail.

Open source: https://github.com/marcothz/GitHub-PR-Threads-for-Gmail
```

**Graphic assets**

| Asset | Size | Required | Source |
| --- | --- | --- | --- |
| Store icon | 128×128 PNG | yes | `icons/icon128.png` |
| Screenshots (1 to 5) | 1280×800 or 640×400 | yes, at least 1 | `store/screenshots/screenshot-1-1280x800.png`; more ideas below |
| Small promo tile | 440×280 | no | |
| Marquee promo tile | 1400×560 | no | |

Screenshot ideas:
1. An open notification with the status chips and both buttons under the subject.
2. The "Find all for PR #N" search results.
3. The Delete all confirmation dialog.
4. The options page after saving a token ("Connected as @…").

Hide or blur any private repository names, people and email content before
uploading.

**Additional fields**

- Homepage URL: `https://github.com/marcothz/GitHub-PR-Threads-for-Gmail`
- Support URL: `https://github.com/marcothz/GitHub-PR-Threads-for-Gmail/issues`

## Privacy tab

**Single purpose**

```text
Show the status of GitHub pull requests on their notification emails in Gmail, and find or trash all notifications about the same pull request.
```

**Permission justifications**

`storage`

```text
Stores the user's GitHub personal access token locally (chrome.storage.local) so the extension can fetch pull request status from the GitHub API. Nothing else is stored.
```

Host permission `https://mail.google.com/*`

```text
The content script reads the subject of the open GitHub notification to get the repository and pull request number, adds the status and the Find all / Delete all buttons under the subject, and, after the user confirms, selects the matching search results and clicks Gmail's own Delete button.
```

Host permission `https://api.github.com/*`

```text
Fetches the pull request's state, review decision and CI status from the GitHub GraphQL API using the user's own token, and checks that a newly saved token is valid.
```

**Remote code**

> No, I am not using remote code. (All JavaScript ships in the package.)

**Data usage**: tick these

- [x] Authentication information (the GitHub token)
- [x] Personal communications (Gmail subjects and row text are read on the page)
- [x] Website content (Gmail page content)

Leave the rest unticked (personally identifiable information, health,
financial, location, web history, user activity).

Certify all three statements:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**

> https://github.com/marcothz/GitHub-PR-Threads-for-Gmail/blob/main/PRIVACY.md

## Distribution tab

- Visibility: Public, Unlisted, or Private (Google Workspace domain only).
- Regions: all regions.

## Package

Releases are automated: see "Releasing" in the README. To build the zips by
hand:

```bash
./store/package.sh
```

It writes `dist/gmail-pr-threads-<version>-webstore.zip` (for the store, with
`manifest.json` at the root) and `dist/gmail-pr-threads-v<version>.zip` (for
the GitHub release). Every store upload needs a higher `version` in
`manifest.json` than the last one.
