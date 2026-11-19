# Privacy Policy for StudyAtrium Capture

_Last updated: 2026-11-19_

**Controller:** the operator of your instance. **Publisher:** see the imprint at <https://lktec.org/impressum>.

StudyAtrium Capture is a browser extension that saves text you select or a full article you're
reading into your [StudyAtrium](https://github.com/lukislp/studylife) instance.
It is a companion tool for a self-hosted, open-source project — there is no StudyAtrium-operated
backend, account system, or analytics service behind it.

## What data the extension handles

- **Server URL and API key** — the address of your StudyAtrium instance and a `CaptureApiKey`,
  obtained via the in-popup **Connect with StudyAtrium** button (a passkey login/consent page on
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
StudyAtrium server URL you entered in the extension's settings popup — an instance you (or whoever
you trust) operate. From there, StudyAtrium's own backend may forward the note to
[studylife-ai](https://github.com/lukislp/studylife-ai) for optional AI enrichment (course matching,
tags, a summary). The AI service is run by whoever operates that StudyAtrium instance, and it may
send the note text to an external language-model provider (for example OpenAI). Whether it does,
and which provider it uses, is decided by the instance operator and is a property of the
StudyAtrium instance you pointed the extension at, not of this extension. Ask your operator if you
need to know.

What the AI enrichment does with a capture (the selection or full article, plus the title and
source URL as stored on the note): the instance's background task sends the note content to the
instance's studylife-ai service for course matching, tags, a one-sentence summary and related-notes
search (embeddings in the instance's own vector store). If the operator configured an external
language-model provider, the note content is therefore also processed by that provider. Nothing
is enriched unless you explicitly captured it.

**The extension itself never sends data to the developer, to Google, or to any third party.**
There is no analytics SDK, no crash reporter, no telemetry, and no remote server operated by this
project. The full source is available at
[github.com/lukislp/studylife-capture](https://github.com/lukislp/studylife-capture) — every
network call the extension makes is visible in [`src/api.ts`](src/api.ts) and
[`src/background.ts`](src/background.ts).

## Data retention and deletion

Locally stored settings (server URL, API key) can be cleared at any time by removing the
extension, or by clearing its data via `chrome://extensions`. Captured content lives entirely on
the StudyAtrium instance you sent it to — deleting it there (StudyAtrium's own Notes page) is the only
place it's retained, since this extension itself does not keep a copy after a successful capture.

The extension has no separate *Disconnect* button. Removing it only deletes the local copy of the
key; to invalidate the key itself, disconnect it on your StudyAtrium instance (Setup -> External
connections) or reconnect from the popup, which replaces it.

## Permissions

See the [Security notes section of the README](README.md#security-notes) for exactly what each
requested permission is used for and why. In short: no permission is requested that isn't
directly required for context-menu capture, local settings storage, or talking to the one server
origin you explicitly configured and granted access to.

## Changes to this policy

Any change to this policy will be made via a pull request to this repository, visible in its
commit history like any other change.

## Contact

For questions about your data (access, deletion, AI processing), contact the operator of your
instance. For questions about the extension itself, open an issue at
[github.com/lukislp/studylife-capture/issues](https://github.com/lukislp/studylife-capture/issues).
