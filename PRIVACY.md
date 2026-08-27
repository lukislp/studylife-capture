# Privacy Policy for StudyLife Capture

_Last updated: 2026-08-27_

StudyLife Capture is a browser extension that saves text you select or a full article you're
reading into your own, self-hosted [StudyLife](https://github.com/lukislp/studylife) instance.
It is a companion tool for a self-hosted, open-source project — there is no StudyLife-operated
backend, account system, or analytics service behind it.

## What data the extension handles

- **Server URL and API key** — the address of your StudyLife instance and a `CaptureApiKey`,
  obtained via the in-popup **Connect with StudyLife** button (a passkey login/consent page on
  your own server, opened through Chrome's `identity` API; self-hosted setups the browser flow
  can't reach can place a manually minted key in extension storage instead, see the README).
  Stored locally in your browser profile (`chrome.storage.local`), never transmitted anywhere
  except as the authentication header on requests to the server URL you entered.
- **Page content you explicitly capture** — the selected text, or (for a full-article capture)
  the article content extracted by [Mozilla Readability](https://github.com/mozilla/readability),
  plus the page's title and URL. This is only collected when you deliberately trigger a capture
  via the right-click context menu — never automatically, never in the background.

No other data is read, stored, or transmitted. The extension does not track browsing history,
does not run on pages you don't explicitly capture from, and does not collect any data when idle.

## Where data goes

Captured content is sent, over HTTPS/HTTP as configured, to exactly one destination: the
StudyLife server URL you entered in the extension's settings popup — an instance you (or whoever
you trust) control and host yourself. From there, StudyLife's own backend may forward the note to
[studylife-ai](https://github.com/lukislp/studylife-ai), also self-hosted, for optional AI
enrichment (course matching, tags, a summary) — that is a property of the StudyLife instance you
pointed the extension at, not of this extension.

**The extension itself never sends data to the developer, to Google, or to any third party.**
There is no analytics SDK, no crash reporter, no telemetry, and no remote server operated by this
project. The full source is available at
[github.com/lukislp/studylife-capture](https://github.com/lukislp/studylife-capture) — every
network call the extension makes is visible in [`src/api.ts`](src/api.ts) and
[`src/background.ts`](src/background.ts).

## Data retention and deletion

Locally stored settings (server URL, API key) can be cleared at any time by removing the
extension, or by clearing its data via `chrome://extensions`. Captured content lives entirely on
the StudyLife instance you sent it to — deleting it there (StudyLife's own Notes page) is the only
place it's retained, since this extension itself does not keep a copy after a successful capture.

## Permissions

See the [Security notes section of the README](README.md#security-notes) for exactly what each
requested permission is used for and why. In short: no permission is requested that isn't
directly required for context-menu capture, local settings storage, or talking to the one server
origin you explicitly configured and granted access to.

## Changes to this policy

Any change to this policy will be made via a pull request to this repository, visible in its
commit history like any other change.

## Contact

Questions or concerns: open an issue at
[github.com/lukislp/studylife-capture/issues](https://github.com/lukislp/studylife-capture/issues).
