import { loadSettings, saveSettings, normalizeServerUrl } from "./settings";

const form = document.getElementById("settings-form") as HTMLFormElement;
const serverUrlInput = document.getElementById("server-url") as HTMLInputElement;
const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const status = document.getElementById("status") as HTMLParagraphElement;

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
  setStatus("Saved.", "success");
});

function setStatus(message: string, kind: "success" | "error"): void {
  status.textContent = message;
  status.className = `status ${kind}`;
}

void init();
