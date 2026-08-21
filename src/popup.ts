import { testConnection } from "./api";
import { loadSettings, saveSettings, normalizeServerUrl } from "./settings";

const form = document.getElementById("settings-form") as HTMLFormElement;
const serverUrlInput = document.getElementById("server-url") as HTMLInputElement;
const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const submitButton = form.querySelector("button[type=submit]") as HTMLButtonElement;

async function init(): Promise<void> {
  const existing = await loadSettings();
  if (existing) {
    serverUrlInput.value = existing.serverUrl;
    apiKeyInput.value = existing.apiKey;
  }
}

form.addEventListener("submit", async (event) => {
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
  submitButton.disabled = true;
  setStatus("Checking connection…", "success");
  const result = await testConnection({ serverUrl, apiKey });
  submitButton.disabled = false;

  if (result.ok) {
    setStatus("Saved and connected.", "success");
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

async function requestHostPermission(origin: string): Promise<boolean> {
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

function setStatus(message: string, kind: "success" | "error"): void {
  status.textContent = message;
  status.className = `status ${kind}`;
}

void init();
