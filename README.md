# GitHub PR Threads for Gmail

Chrome extension (Manifest V3) for GitHub pull request notifications in Gmail.

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/github-pr-threads-for-gma/fclgmbaligcklgjbbepegfjacmhikaan)**

## Features

- **PR status under the subject**: state (Open, Draft, Merged, Closed), review
  decision (Approved, Changes requested, Review required) and CI checks
  (passing, failing, running). The state chip links to the PR on GitHub.
- **Find all for the PR**: runs
  `from:notifications@github.com subject:"[owner/repo]" subject:"PR #N"`.
- **Delete all for the PR**: runs the same search, selects only the rows
  whose subject names this repository and PR, asks for confirmation and
  clicks Gmail's own Delete button. Emails go to Trash (Gmail offers Undo
  and keeps them for 30 days). Only the current page of results is
  affected; run it again if there are more.

## Triggers

| Action | Button under the subject | Shortcut | Toolbar icon |
| --- | --- | --- | --- |
| Find all | Find all for PR #N | `Alt+Shift+P` | yes |
| Delete all | Delete all for PR #N | `Alt+Shift+D` | no |

Shortcuts work on an open PR email and on the extension's search results
page. Change them at `chrome://extensions/shortcuts`.

## Gmail markup

Deletion drives Gmail's interface, so it relies on Gmail's markup. All
selectors live in the `GMAIL` object at the top of `content.js`; if Gmail
changes, update them there.

## Setup

1. Install the extension from the
   [Chrome Web Store](https://chromewebstore.google.com/detail/github-pr-threads-for-gma/fclgmbaligcklgjbbepegfjacmhikaan).
2. Open the extension's **Details → Extension options** and save a GitHub
   personal access token:
   - Fine-grained: read-only *Pull requests*, *Commit statuses* and *Contents*.
   - Classic: `repo` scope.
   - Authorize it for your organization's SSO if required.
3. Reload Gmail.

To run it from source instead, open `chrome://extensions`, turn on
**Developer mode**, click **Load unpacked** and select this folder (or click
**Reload** if it was already installed), then follow steps 2 and 3.

## How the status is fetched

`content.js` asks `background.js` for the status; the background worker calls
the GitHub GraphQL API with the token and caches successful results for 60
seconds. The token is kept in `chrome.storage.local` and never reaches Gmail's
page.

## Files

- `manifest.json` – config, permissions, shortcut.
- `content.js` – runs in Gmail: parses the subject, renders the status bar, runs the search.
- `content.css` – status chips, button and toast styles.
- `background.js` – shortcut/toolbar relay and GitHub API calls.
- `options.html`, `options.js` – token settings page.
- `icons/` – extension icons (16, 32, 48, 128 px).
- `store/` – Chrome Web Store listing texts and release scripts.
- `PRIVACY.md` – privacy policy.

## Releasing

1. Bump `"version"` in `manifest.json` and commit.
2. Tag and push:

   ```bash
   git tag v<version> && git push origin main v<version>
   ```

The [Release workflow](.github/workflows/release.yml) checks that the tag
matches the manifest, builds the zips, creates the GitHub release and uploads
the new version to the Chrome Web Store for review.

The store upload needs credentials. Set them up once with
`./store/setup-webstore-api.sh`, which walks you through Google Cloud and
saves them as GitHub secrets and variables. Without them, the workflow still
creates the GitHub release and skips the store.

A new version can't be submitted while the previous one is still in review.
If the store step fails for that reason, re-run the job once the review ends.

## License

MIT. See [LICENSE](LICENSE).
