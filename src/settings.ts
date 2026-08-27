// Self-hosted, so unlike a typical extension there's no single fixed API host -
// every user points this at their own StudyLife instance.
export interface CaptureSettings {
  serverUrl: string;
  apiKey: string;
}

const STORAGE_KEY = "settings";

// Whatever is stored, connected or not: the popup persists the server URL as a draft (with an
// empty apiKey) the moment Connect is clicked, so a popup killed by the permission prompt
// doesn't lose the field - this loader is what restores that draft on reopen.
export async function loadStoredSettings(): Promise<CaptureSettings | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] as CaptureSettings | undefined;
  if (!settings?.serverUrl) return null;
  return settings;
}

// Connected settings only - capture paths need a usable key, a URL-only draft is not enough.
export async function loadSettings(): Promise<CaptureSettings | null> {
  const settings = await loadStoredSettings();
  return settings?.apiKey ? settings : null;
}

export async function saveSettings(settings: CaptureSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

// Strips a trailing slash so callers can safely do `${serverUrl}/api/...`
// regardless of whether the user pasted a trailing slash in the popup's URL field.
export function normalizeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}
