import { CONNECT_MESSAGE_TYPE, clearPendingConnect, describeConnectResult, requestHostPermission, setPendingConnect, type ConnectResult } from "./connect";
import { loadSettings, saveSettings, normalizeServerUrl } from "./settings";

const serverUrlInput = document.getElementById("server-url") as HTMLInputElement;
const connectionHint = document.getElementById("connection-hint") as HTMLParagraphElement;

const connectButton = document.getElementById("connect-button") as HTMLButtonElement;
const connectStatus = document.getElementById("connect-status") as HTMLParagraphElement;

async function init(): Promise<void> {
  const existing = await loadSettings();
  if (existing) {
    serverUrlInput.value = existing.serverUrl;
    // The URL alone is persisted as a draft the moment Connect is clicked (so a popup killed by
    // the permission prompt doesn't lose it) - only an actual key means "connected". When
    // connected, the button stays available on purpose but says what it actually does now:
    // re-running the consent flow ROTATES the capture key server-side - the recovery path after
    // an emergency disconnect on the StudyLife setup page, and harmless otherwise (the old key
    // is simply replaced with the fresh one).
    if (existing.apiKey) {
      connectionHint.textContent = `Connected to ${existing.serverUrl}`;
      connectionHint.classList.add("success");
      connectButton.textContent = "Reconnect";
      setConnectStatus("Already connected - reconnecting replaces the current key (use after a disconnect).", "success");
    }
  }
}

// Primary path: browser-consent connect via chrome.identity. See src/connect.ts for the full
// design rationale - in short, this button's click is only used to kick the flow off; the actual
// permission prompt, auth window, and token exchange all run in the background service worker,
// because the auth window steals focus and closes this popup the moment it opens (the same
// focus-loss failure the manual-save flow below already works around). So this handler can't rely
// on being alive by the time the flow finishes - it shows a "check for a window" hint immediately,
// then updates the status only in the (uncommon) case the popup is still around to receive it.
// The reliable outcome channel is the OS notification background.ts sends either way.
// async is fine for the gesture: the permission request below runs before the first await
// boundary consumes the transient activation (the contains() fast path resolves immediately,
// and Chrome keeps the activation across the request prompt itself).
connectButton.addEventListener("click", async () => {
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  if (!serverUrl) {
    setConnectStatus("Enter your StudyLife server URL first.", "error");
    return;
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(serverUrl);
  } catch {
    setConnectStatus("Enter a valid server URL, e.g. https://studylife.example.com", "error");
    return;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    setConnectStatus("Enter a valid server URL, e.g. https://studylife.example.com", "error");
    return;
  }

  connectButton.disabled = true;

  // Persist the URL immediately so a killed popup doesn't lose it - before this, the field was
  // only saved after a SUCCESSFUL connect, so the reopen-after-prompt landed on an empty form
  // (hit live). The existing apiKey (if any) is kept untouched.
  const existingSettings = await loadSettings();
  await saveSettings({ serverUrl, apiKey: existingSettings?.apiKey ?? "" });

  // The host-permission request MUST happen here in the popup, inside the button's own user
  // gesture (permissions.request from the service worker throws). But the prompt steals focus
  // and CLOSES this popup between the user's grant and any code after this await - so for the
  // prompt path we don't continue from here at all: a pending-connect marker is staked first,
  // and background.ts's permissions.onAdded listener starts the auth flow the moment the grant
  // lands, popup survival not required (one click end-to-end). The already-granted fast path
  // skips the marker and messages the worker directly, exactly as before.
  const originPattern = parsedUrl.origin + "/*";
  if (!(await chrome.permissions.contains({ origins: [originPattern] }))) {
    await setPendingConnect(serverUrl);
    setConnectStatus("Grant the permission prompt - StudyLife's login window then opens automatically.", "success");
    const granted = await requestHostPermission(originPattern);
    if (!granted) {
      await clearPendingConnect();
      connectButton.disabled = false;
      setConnectStatus("Permission to access this server was denied - connecting needs it (click again to retry).", "error");
    }
    // Granted and still alive: nothing to do - the onAdded listener has already taken over.
    return;
  }

  setConnectStatus("Opening StudyLife's login pageâ€¦ if a window opens, this popup will close - " +
    "look for a confirmation notification once you're done.", "success");

  chrome.runtime
    .sendMessage({ type: CONNECT_MESSAGE_TYPE, serverUrl })
    .then((result: ConnectResult) => {
      // Only reachable if the popup survived the whole flow (e.g. the permission/origin was
      // already granted and no auth window was needed) - most of the time this popup is gone
      // before this ever runs, and that's fine: background.ts's notification already told the
      // user what happened.
      connectButton.disabled = false;
      setConnectStatus(describeConnectResult(result), result.ok ? "success" : "error");
      if (result.ok) {
        void init();
      }
    })
    .catch(() => {
      // The popup is about to close (or already did) - nothing to show, nothing to clean up.
    });
});

// The manual paste-an-API-key fallback is gone: since the StudyLife setup page dropped its
// capture card, no UI exists that could even produce a key to paste - the browser-consent
// connect above is THE provisioning path. Self-hosted instances the auth window can't reach
// (self-signed certificate on a LAN) can still mint a key against the API directly and place
// it in extension storage - documented in the README as the escape hatch, deliberately not a
// form here.

function setConnectStatus(message: string, kind: "success" | "error"): void {
  connectStatus.textContent = message;
  connectStatus.className = `status ${kind}`;
}

void init();
