import { normalizeServerUrl, type CaptureSettings } from "./settings";

export interface CaptureRequest {
  title: string;
  content: string;
  sourceUrl: string;
}

// Wire shape of StudyLife.Shared.Dtos.NoteDto (POST /api/notes). Id/CreatedAt/UpdatedAt
// are server-assigned and ignored on create; CourseId/SessionId stay null (the extension
// has no course context yet - S2 may add AI-driven course matching).
interface NoteDtoPayload {
  title: string;
  content: string;
  sourceUrl: string;
  courseId: number | null;
  sessionId: number | null;
  isMarkdown: boolean;
}

// The wire field names NoteDtoPayload sends, kept in sync with the interface above by the two
// compile-time checks below. scripts/contract-check.mjs parses this array out of the source text
// (by regex - it's plain Node with no TS toolchain) and diffs it against the committed OpenAPI
// spec's NoteDto schema, so a server-side field rename/removal fails CI here instead of silently
// 401/400-ing once the Web Store review finally lets a drifted build reach users.
export const NOTE_PAYLOAD_FIELDS = [
  "title",
  "content",
  "sourceUrl",
  "courseId",
  "sessionId",
  "isMarkdown",
] as const satisfies readonly (keyof NoteDtoPayload)[];

// `satisfies` above only checks that every array entry is a real key of NoteDtoPayload. This
// checks the reverse - that every key of NoteDtoPayload is listed in the array - so adding a
// field to the interface without adding it here fails to typecheck instead of silently
// desyncing the list the contract check relies on.
type AllPayloadFieldsListed =
  Exclude<keyof NoteDtoPayload, (typeof NOTE_PAYLOAD_FIELDS)[number]> extends never ? true : never;
const allPayloadFieldsListed: AllPayloadFieldsListed = true;

// A network round trip that hangs forever (unreachable server, no TCP reset) would otherwise
// leave the user staring at "Saving..." indefinitely with no feedback - found relevant while
// working through the offline/error-handling pass (S4).
const REQUEST_TIMEOUT_MS = 15_000;

// A discriminated `kind` instead of a bare status/message pair, so callers (background.ts's
// notification text, popup.ts's connection test) can give the user a specific, actionable
// message per failure mode instead of a raw HTTP status or browser error string.
export type CaptureResult =
  | { ok: true }
  | { ok: false; kind: "offline" }
  | { ok: false; kind: "unauthorized" }
  | { ok: false; kind: "http"; status: number; message: string }
  | { ok: false; kind: "network"; message: string };

// The extension authenticates with a long-lived CaptureApiKey (generated in
// StudyLife's Setup page, same pattern as the existing AiApiKey/McpApiKey) via the
// server's unified X-Api-Key gate, which lets it call the existing /api/notes endpoint
// directly - no dedicated /api/capture endpoint needed until S2's AI-enrichment forwarding.
export async function saveCapture(
  settings: CaptureSettings,
  request: CaptureRequest,
): Promise<CaptureResult> {
  // navigator.onLine is a rough signal (true doesn't guarantee real connectivity, e.g. behind a
  // captive portal), but false is a reliable "definitely offline" - checking it first avoids a
  // 15s timeout wait for the single most common failure case (no network at all).
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, kind: "offline" };
  }

  const url = `${normalizeServerUrl(settings.serverUrl)}/api/notes`;
  const payload: NoteDtoPayload = {
    title: request.title,
    content: request.content,
    sourceUrl: request.sourceUrl,
    courseId: null,
    sessionId: null,
    isMarkdown: false,
  };
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      return { ok: false, kind: "unauthorized" };
    }
    if (!response.ok) {
      return { ok: false, kind: "http", status: response.status, message: await safeText(response) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, kind: "network", message: describeError(error) };
  }
}

export type ConnectionTestResult =
  | { ok: true }
  | { ok: false; kind: "offline" }
  | { ok: false; kind: "unauthorized" }
  | { ok: false; kind: "network"; message: string };

// Verifies a serverUrl/apiKey pair actually works, called from popup.ts right after the user
// saves settings - so a typo'd URL or an already-revoked key is caught immediately instead of
// only surfacing later as a failed capture notification the user then has to trace back to the
// settings that caused it. GET /api/notes is the same endpoint saveCapture() itself needs
// working credentials for, so a successful test here is a direct guarantee, not a proxy check.
export async function testConnection(settings: CaptureSettings): Promise<ConnectionTestResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, kind: "offline" };
  }
  const url = `${normalizeServerUrl(settings.serverUrl)}/api/notes`;
  try {
    const response = await fetchWithTimeout(url, { headers: { "X-Api-Key": settings.apiKey } });
    if (response.status === 401) return { ok: false, kind: "unauthorized" };
    if (!response.ok) return { ok: false, kind: "network", message: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, kind: "network", message: describeError(error) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request timed out.";
  }
  return error instanceof Error ? error.message : String(error);
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}
