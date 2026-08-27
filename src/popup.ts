import { testConnection } from "./api";
import { CONNECT_MESSAGE_TYPE, describeConnectResult, requestHostPermission, type ConnectResult } from "./connect";
import { loadSettings, saveSettings, normalizeServerUrl } from "./settings";

const serverUrlInput = document.getElementById("server-url") as HTMLInputElement;
const connectionHint = document.getElementById("connection-hint") as HTMLParagraphElement;

const connectButton = document.getElementById("connect-button") as HTMLButtonElement;
const connectStatus = document.getElementById("connect-status") as HTMLParagraphElement;

const toggleManualButton = document.getElementById("toggle-manual") as HTMLButtonElement;
const manualForm = document.getElementById("settings-form") as HTMLFormElement;
const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const manualSubmitButton = manualForm.querySelector("button[type=submit]") as HTMLButtonElement;

async function init(): Promise<void> {
  const existing = await loadSettings();
  if (existing) {
    serverUrlInput.value = existing.serverUrl;
    apiKeyInput.value = existing.apiKey;
    connectionHint.textContent = `Connected to ${existing.serverUrl}`;
    connectionHint.classList.add("success");
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

  // The host-permission request MUST happen here in the popup, inside the button's own user
  // gesture: chrome.permissions.request() from the service worker throws "This function must be
  // called during a user gesture" - the transient-activation propagation across
  // runtime.sendMessage the original design relied on does not reach permissions.request in
  // practice (hit live on current Chrome). Same proven pattern as the manual-save flow above;
  // same known trade-off too: the prompt can steal focus and close this popup mid-await, but the
  // grant persists, so a second click then sails through the already-granted fast path.
  const granted = await requestHostPermission(parsedUrl.origin + "/*");
  if (!granted) {
    connectButton.disabled = false;
    setConnectStatus("Permission to access this server was denied - connecting needs it (click again to retry).", "error");
    return;
  }

  setConnectStatus("Opening StudyLife's login page… if a window opens, this popup will close - " +
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

toggleManualButton.addEventListener("click", () => {
  const expanded = toggleManualButton.getAttribute("aria-expanded") === "true";
  manualForm.hidden = expanded;
  toggleManualButton.setAttribute("aria-expanded", String(!expanded));
  toggleManualButton.textContent = expanded ? "Enter API key manually instead" : "Hide manual entry";
});

// Fallback path: paste a server URL + API key directly, no browser redirect involved. Kept fully
// working alongside the connect button above - some self-hosted instances (e.g. a self-signed
// certificate on a local network) aren't reachable through chrome.identity.launchWebAuthFlow's
// browser-managed auth window at all, so this is the only way those users can connect.
manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  const apiKey = apiKeyInput.value.trim();

  if (!serverUrl || !apiKey) {
    setStatus("Both fields are required.", "error");
    return;
  }

  let origin: string;
  try {
    origin = `${new URL(serverUrl).origin}/*`;
  } catch {
    setStatus("Enter a valid server URL, e.g. https://studylife.example.com", "error");
    return;
  }

  // Save BEFORE requesting the host permission below - not after. Chrome's native permission
  // prompt can steal window focus, and an extension action popup auto-closes the instant it
  // loses focus, killing this whole async handler mid-await (found live: the popup closed right
  // as the user clicked "Allow", so the saveSettings() call that used to come after this point
  // never ran, and both fields were lost). Saving first means the data survives regardless of
  // what happens to the popup once the permission prompt appears.
  await saveSettings({ serverUrl, apiKey });

  // No broad host_permissions declared upfront (see manifest.json) - instead, request access to
  // exactly the one origin just saved above. Persists once granted, so this is a no-op on every
  // later save unless the user points the extension at a different origin.
  const granted = await requestHostPermission(origin);
  if (!granted) {
    setStatus(
      "Saved, but permission to access this server was denied - captures won't work until it's granted (save again to retry).",
      "error",
    );
    return;
  }

  // Verify the pair actually works right away - a typo'd URL or an already-revoked key would
  // otherwise only surface later as a failed capture notification the user then has to trace
  // back to these settings.
  manualSubmitButton.disabled = true;
  setStatus("Checking connection…", "success");
  const result = await testConnection({ serverUrl, apiKey });
  manualSubmitButton.disabled = false;

  if (result.ok) {
    setStatus("Saved and connected.", "success");
    connectionHint.textContent = `Connected to ${serverUrl}`;
    connectionHint.classList.add("success");
    return;
  }
  switch (result.kind) {
    case "offline":
      setStatus("Saved, but you're offline right now - couldn't verify the connection.", "error");
      break;
    case "unauthorized":
      setStatus("Saved, but this API key is invalid or was revoked - generate a new one in StudyLife's Setup page.", "error");
      break;
    case "network":
      setStatus(`Saved, but couldn't reach this server: ${result.message}`, "error");
      break;
  }
});

function setConnectStatus(message: string, kind: "success" | "error"): void {
  connectStatus.textContent = message;
  connectStatus.className = `status ${kind}`;
}

function setStatus(message: string, kind: "success" | "error"): void {
  status.textContent = message;
  status.className = `status ${kind}`;
}

void init();
