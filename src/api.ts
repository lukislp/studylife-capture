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

export type CaptureResult =
  | { ok: true }
  | { ok: false; status: number | null; message: string };

// The extension authenticates with a long-lived CaptureApiKey (generated in
// StudyLife's Setup page, same pattern as the existing AiApiKey/McpApiKey) via the
// server's unified X-Api-Key gate, which lets it call the existing /api/notes endpoint
// directly - no dedicated /api/capture endpoint needed until S2's AI-enrichment forwarding.
export async function saveCapture(
  settings: CaptureSettings,
  request: CaptureRequest,
): Promise<CaptureResult> {
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
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.apiKey,
      },
      body: JSON.stringify(payload),
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
