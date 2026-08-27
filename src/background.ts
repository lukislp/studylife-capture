import { exchangeCaptureAssertion, saveCapture } from "./api";
import {
  describeConnectResult,
  isConnectMessage,
  parseAuthRedirect,
  requestHostPermission,
  takePendingConnect,
  type ConnectResult,
} from "./connect";
import { loadSettings, normalizeServerUrl, saveSettings } from "./settings";

const SELECTION_MENU_ID = "save-selection-to-studylife";
const ARTICLE_MENU_ID = "save-article-to-studylife";
// Matches article-extractor.ts's message shape exactly - kept in sync manually since the two
// files can't share a type import (article-extractor.js is injected as a standalone bundle
// into the page, not part of this service worker's module graph).
const ARTICLE_EXTRACTED_MESSAGE = "studylife-capture:article-extracted";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: SELECTION_MENU_ID,
    title: "Save selection to StudyLife",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: ARTICLE_MENU_ID,
    title: "Save full article to StudyLife",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === SELECTION_MENU_ID && info.selectionText) {
    await capture(tab?.title ?? info.pageUrl, info.selectionText, info.pageUrl);
    return;
  }
  if (info.menuItemId === ARTICLE_MENU_ID) {
    await extractAndCaptureArticle(tab);
  }
});

// Readability needs a real DOM (document.cloneNode, computed styles for visibility scoring) -
// unavailable in this service worker, so the actual parsing runs injected into the page itself
// (article-extractor.ts) and reports back via chrome.runtime.onMessage below.
async function extractAndCaptureArticle(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["article-extractor.js"] });
  } catch (error) {
    notify(
      "StudyLife Capture failed",
      `Could not read this page: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Popup-death handoff (see connect.ts's pending-connect comment): the host-permission prompt
// closes the popup between the user's grant and any code after its await, so for the prompt
// path the popup only stakes a pending-connect marker and requests - THIS listener continues
// the flow the moment the grant lands. The marker is consume-once + TTL-bound (takePendingConnect),
// and the origin check makes sure an unrelated permission grant can't trigger a stale connect.
chrome.permissions.onAdded.addListener((added) => {
  void (async () => {
    const serverUrl = await takePendingConnect(added.origins ?? []);
    if (!serverUrl) return;
    await handleConnectRequest(serverUrl).catch((e: unknown) =>
      finishConnect({ ok: false, kind: "auth-window-failed", message: e instanceof Error ? e.message : String(e) }));
  })();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (isConnectMessage(message)) {
    // Returning true keeps the message channel open so the sendResponse below can fire once
    // handleConnectRequest's async chain resolves - see connect.ts for why this whole flow lives
    // here rather than in popup.ts. sendResponse is best-effort: if the popup already closed (the
    // expected, common case once the auth window opens), this simply has no listener left to
    // reach, and the notify() call inside handleConnectRequest is what the user actually sees.
    // The .catch is load-bearing: an unhandled rejection here dies silently in the service
    // worker and the user sees NOTHING - no window, no notification (exactly the failure mode
    // the gesture crash produced). Any unexpected error must still reach finishConnect's
    // notification channel.
    void handleConnectRequest(message.serverUrl)
      .catch((e: unknown) =>
        finishConnect({ ok: false, kind: "auth-window-failed", message: e instanceof Error ? e.message : String(e) }))
      .then(sendResponse);
    return true;
  }

  if (typeof message !== "object" || message === null || (message as { type?: unknown }).type !== ARTICLE_EXTRACTED_MESSAGE) {
    return undefined;
  }
  const { title, content, error } = message as { title?: string; content?: string; error?: string };
  if (error) {
    notify("StudyLife Capture failed", error);
    return undefined;
  }
  void capture(title ?? sender.tab?.title ?? "Untitled", content ?? "", sender.tab?.url ?? "");
  return undefined;
});

// Runs the whole browser-consent connect flow triggered by the "Connect with StudyLife" button in
// popup.ts: requests the optional host permission for the user's server origin, opens the
// passkey login/consent page via chrome.identity, exchanges the resulting assertion for a
// CaptureApiKey, and stores it exactly where the manual-paste path does (settings.ts). See
// connect.ts's top comment for why this has to run in the service worker, not the popup.
async function handleConnectRequest(rawServerUrl: string): Promise<ConnectResult> {
  const serverUrl = normalizeServerUrl(rawServerUrl);

  let origin: string;
  try {
    origin = `${new URL(serverUrl).origin}/*`;
  } catch {
    return { ok: false, kind: "invalid-url" };
  }

  // Contains-check ONLY - the actual permissions.request() happens in the popup, inside the
  // button's own user gesture. Requesting from here crashed with "This function must be called
  // during a user gesture": the transient-activation propagation across runtime.sendMessage the
  // original design relied on does not reach permissions.request in practice (hit live). The
  // popup grants before messaging us, so this is normally a formality; it only fails if the
  // popup died before the grant landed - then the notification tells the user to click again.
  const granted = await chrome.permissions.contains({ origins: [origin] });
  if (!granted) {
    return finishConnect({ ok: false, kind: "permission-denied" });
  }

  // A fresh random value per attempt, round-tripped through the redirect_uri's query string and
  // checked back below - guards against a forged or stale redirect to the extension's
  // chromiumapp.org callback URL being accepted as a real server response.
  const state = crypto.randomUUID();
  const authUrl = new URL("/connect/capture", serverUrl);
  authUrl.searchParams.set("redirect_uri", chrome.identity.getRedirectURL());
  authUrl.searchParams.set("state", state);

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  } catch (error) {
    // Chrome reports both "user closed the auth window" and "user clicked deny on the consent
    // page" as a rejected promise with a generic message - no reliable way to tell them apart, so
    // both surface as the same friendly "cancelled" result rather than a scary error.
    const message = error instanceof Error ? error.message : String(error);
    if (/did not approve|cancel/i.test(message)) {
      return finishConnect({ ok: false, kind: "cancelled" });
    }
    return finishConnect({ ok: false, kind: "auth-window-failed", message });
  }
  if (!responseUrl) {
    return finishConnect({ ok: false, kind: "cancelled" });
  }

  const redirectResult = parseAuthRedirect(responseUrl, state);
  if (!redirectResult.ok) {
    return finishConnect({ ok: false, kind: redirectResult.kind });
  }

  const exchange = await exchangeCaptureAssertion(serverUrl, redirectResult.assertion);
  if (!exchange.ok) {
    switch (exchange.kind) {
      case "offline":
        return finishConnect({ ok: false, kind: "offline" });
      case "not-found":
        return finishConnect({ ok: false, kind: "server-outdated" });
      case "http":
        return finishConnect({
          ok: false,
          kind: "exchange-failed",
          message: exchange.message || `HTTP ${exchange.status}`,
        });
      case "network":
        return finishConnect({ ok: false, kind: "exchange-failed", message: exchange.message });
    }
  }

  await saveSettings({ serverUrl, apiKey: exchange.captureApiKey });
  return finishConnect({ ok: true, serverUrl });
}

// Always notifies (the reliable channel - see handleConnectRequest's comment) and returns the
// result unchanged, so every return path above can just be `return finishConnect(result)`.
function finishConnect(result: ConnectResult): ConnectResult {
  if (result.ok) {
    notify("Connected to StudyLife", result.serverUrl);
  } else {
    notify("StudyLife Connect failed", describeConnectResult(result));
  }
  return result;
}

async function capture(title: string, content: string, sourceUrl: string): Promise<void> {
  const settings = await loadSettings();
  if (!settings) {
    notify("StudyLife Capture", "Set your server URL and API key in the extension popup first.");
    return;
  }

  const result = await saveCapture(settings, { title, content, sourceUrl });

  if (result.ok) {
    notify("Saved to StudyLife", title);
    return;
  }

  switch (result.kind) {
    case "offline":
      notify("StudyLife Capture failed", "You're offline - try again once you're back online.");
      break;
    case "unauthorized":
      notify(
        "StudyLife Capture failed",
        "Your API key is invalid or was revoked. Generate a new one in StudyLife's Setup page and update it in the extension popup.",
      );
      break;
    case "http":
      notify("StudyLife Capture failed", `HTTP ${result.status}: ${result.message}`.slice(0, 200));
      break;
    case "network":
      notify("StudyLife Capture failed", `Could not reach the StudyLife server: ${result.message}`.slice(0, 200));
      break;
  }
}

function notify(title: string, message: string): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message,
  });
}
