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

  // No broad host_permissions declared upfront (see manifest.json) - instead, request access to
  // exactly the one origin the user just typed in, right here in the submit handler so it still
  // counts as a user gesture for chrome.permissions.request(). Persists once granted, so this is
  // a no-op on every later save unless the user points the extension at a different origin.
  const permission = await ensureHostPermission(serverUrl);
  if (permission === "invalid-url") {
    setStatus("Enter a valid server URL, e.g. https://studylife.example.com", "error");
    return;
  }
  if (permission === "denied") {
    setStatus("Permission to access this server was denied - required to save captures there.", "error");
    return;
  }

  await saveSettings({ serverUrl, apiKey });

  // Verify the pair actually works right away - a typo'd URL or an already-revoked key would
  // otherwise only surface later as a failed capture notification the user then has to trace
  // back to these settings. Save happens unconditionally above (even if the test fails) - the
  // server might just be temporarily unreachable, and the settings are still what the user
  // wants stored for when it comes back.
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

async function ensureHostPermission(serverUrl: string): Promise<"granted" | "denied" | "invalid-url"> {
  let origin: string;
  try {
    origin = `${new URL(serverUrl).origin}/*`;
  } catch {
    return "invalid-url";
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return "granted";
  return (await chrome.permissions.request({ origins: [origin] })) ? "granted" : "denied";
}

function setStatus(message: string, kind: "success" | "error"): void {
  status.textContent = message;
  status.className = `status ${kind}`;
}

void init();
