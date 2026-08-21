// Self-hosted, so unlike a typical extension there's no single fixed API host -
// every user points this at their own StudyLife instance.
export interface CaptureSettings {
  serverUrl: string;
  apiKey: string;
}

const STORAGE_KEY = "settings";

export async function loadSettings(): Promise<CaptureSettings | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] as CaptureSettings | undefined;
  if (!settings?.serverUrl || !settings?.apiKey) return null;
  return settings;
}

export async function saveSettings(settings: CaptureSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

// Strips a trailing slash so callers can safely do `${serverUrl}/api/...`
// regardless of whether the user pasted a trailing slash in the settings form.
export function normalizeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}
