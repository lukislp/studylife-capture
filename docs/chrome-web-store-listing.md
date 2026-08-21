# Chrome Web Store submission prep

Working notes and ready-to-paste text for the Developer Dashboard submission. Nothing here is
enforced by code - it's the content the dashboard's forms ask for once the extension is actually
submitted. Update this file (not just the dashboard) if any of it changes, so it stays the source
of truth.

## Prerequisites (not done here)

- [ ] Register a Chrome Web Store Developer Dashboard account (one-time $5 fee).
- [ ] At least one real screenshot, 1280x800 or 640x400 (actual UI, not a mockup).
- [ ] Small promo tile, 440x280 (optional but recommended).
- [ ] Privacy Policy URL, pointing at a reachable copy of [`PRIVACY.md`](../PRIVACY.md) - e.g.
      `https://github.com/lukislp/studylife-capture/blob/main/PRIVACY.md`.

## Single purpose description

> Save text you select, or a full article you're reading, from any web page into your own
> self-hosted StudyLife instance as a note - nothing else.

## Store listing

**Category:** Productivity

**Short description** (Chrome's summary field, ~132 char limit):

> Save selected text or full articles into your self-hosted StudyLife instance as notes.

**Detailed description:**

> A Chrome extension for saving selected text or whole articles into StudyLife
> (github.com/lukislp/studylife) as notes, with optional AI enrichment (course matching, tags, a
> summary) handled by your own StudyLife instance.
>
> Self-hosted by design: every install points at your own StudyLife server, entered once in the
> extension's settings popup. There's no fixed backend, no account to sign up for with this
> extension, and no data collected by the developer - see the Privacy Policy for the full
> breakdown of what stays local and what's sent to your own server.
>
> Requires a running StudyLife instance (github.com/lukislp/studylife) and a CaptureApiKey
> generated on its Setup page.

## Permission justifications

Paste one of these into the corresponding field in the dashboard's "Permissions" tab.

**`contextMenus`**
> Adds the two right-click menu items ("Save selection to StudyLife" and "Save full article to
> StudyLife") that are the extension's only way to trigger a capture. Without it there is no way
> to invoke the extension's core function.

**`storage`**
> Persists the user's StudyLife server URL and personal API key locally
> (`chrome.storage.local`) between browser sessions, so they don't have to re-enter them before
> every capture.

**`notifications`**
> Shows a brief, local notification confirming a capture succeeded, or explaining why it failed
> (offline, invalid key, unreachable server). No data leaves the device for this - it's a local
> OS notification only.

**`scripting`**
> Used together with `activeTab` to inject a Mozilla-Readability-based article extractor into the
> current page - but only when the user explicitly chooses "Save full article to StudyLife" from
> the context menu. Never runs automatically or on page load.

**`activeTab`**
> Grants the `scripting` injection above access to only the single tab the user just
> right-clicked in, for that one action, instead of requesting standing access to every page via
> `host_permissions`.

**Host permissions** (`optional_host_permissions`: `http://*/*`, `https://*/*`)
> This extension is self-hosted: every install points at a different, user-chosen StudyLife
> server address, so no single fixed domain can be declared upfront. Nothing is granted
> automatically - the extension requests access to exactly the one origin the user enters in the
> settings popup, via `chrome.permissions.request()`, the moment they save it. It never has
> standing access to any other site, and `chrome.permissions.contains()` is checked first so
> re-saving the same origin never re-prompts.

## Data safety questionnaire

Chrome's "Data usage" disclosure categories, as they apply here - see
[`PRIVACY.md`](../PRIVACY.md) for the full narrative version.

| Category | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | **Yes** | The `CaptureApiKey`, stored locally, used only to authenticate to the user's own configured server. |
| Personal communications | No | |
| Location | No | |
| Web history | **Yes** | The URL of the page being captured is sent along with the note (`sourceUrl`), to the user's own server only. |
| User activity | No | |
| Website content | **Yes** | The selected text or extracted article content the user explicitly chooses to capture. |

For every "Yes" row: purpose is **App functionality** only (never advertising, analytics, or
personalization); data is **not sold**; data is **not used for purposes unrelated to the item's
core functionality**; data is **not transferred to third parties** (it goes only to the single
server origin the user configured, which is not this project's infrastructure).

**"Does this item use remote code?"** → **No.** Manifest V3's default CSP (`script-src 'self'`)
is not loosened anywhere in `manifest.json` - no `eval`, no `new Function`, no remotely-fetched
scripts. Confirmed by grep across `src/` as of this writing.
