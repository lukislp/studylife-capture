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

function setStatus(message: string, kind: "success" | "error"): void {
  status.textContent = message;
  status.className = `status ${kind}`;
}

void init();
