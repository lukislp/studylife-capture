import { normalizeServerUrl, type CaptureSettings } from "./settings";

export interface CaptureRequest {
  title: string;
  content: string;
  sourceUrl: string;
}

export type CaptureResult =
  | { ok: true }
  | { ok: false; status: number | null; message: string };

// The extension authenticates with a long-lived CaptureApiKey (generated in
// StudyLife's Setup page, same pattern as the existing AiApiKey/McpApiKey) -
// not a passkey session, since there's no interactive login flow from a
// background service worker/popup.
export async function saveCapture(
  settings: CaptureSettings,
  request: CaptureRequest,
): Promise<CaptureResult> {
  const url = `${normalizeServerUrl(settings.serverUrl)}/api/capture`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Capture-Api-Key": settings.apiKey,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, message: await safeText(response) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, status: null, message: error instanceof Error ? error.message : String(error) };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}
