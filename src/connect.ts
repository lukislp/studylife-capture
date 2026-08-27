// Browser-consent connect flow: shared between popup.ts (where the user clicks "Connect with
// StudyLife", i.e. where the trusted user gesture originates) and background.ts (which actually
// runs the flow). It has to live in the service worker, not the popup, because
// chrome.identity.launchWebAuthFlow()'s interactive auth window steals focus and closes the
// extension popup mid-await - the same focus-loss behavior the plain chrome.permissions.request()
// prompt already shows (see popup.ts). Running the
// whole chain (permission request, auth window, token exchange) in the service worker means it
// survives regardless of what happens to the popup once either dialog opens.

export const CONNECT_MESSAGE_TYPE = "studylife-capture:connect";

export interface ConnectMessage {
  type: typeof CONNECT_MESSAGE_TYPE;
  serverUrl: string;
}

export function isConnectMessage(message: unknown): message is ConnectMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === CONNECT_MESSAGE_TYPE &&
    typeof (message as { serverUrl?: unknown }).serverUrl === "string"
  );
}

export type ConnectResult =
  | { ok: true; serverUrl: string }
  | { ok: false; kind: "invalid-url" }
  | { ok: false; kind: "permission-denied" }
  | { ok: false; kind: "cancelled" }
  | { ok: false; kind: "auth-window-failed"; message: string }
  | { ok: false; kind: "invalid-redirect" }
  | { ok: false; kind: "state-mismatch" }
  | { ok: false; kind: "server-outdated" }
  | { ok: false; kind: "offline" }
  | { ok: false; kind: "exchange-failed"; message: string };

// Pure and exported specifically so it's unit-testable without any chrome.* mocking - parses the
// redirect chrome.identity.launchWebAuthFlow() hands back
// (<redirect_uri>?assertion=..&state=..) and checks the state round-trips, guarding against a
// forged or replayed redirect landing on the extension's own chromiumapp.org callback URL.
//
// No test runner exists in this repo yet (see package.json's scripts - only typecheck/build/
// contract-check/package), so this isn't wired into an actual test suite. It's still factored out
// as a standalone pure function rather than inlined into background.ts so that adding one later is
// just adding a test file, not a refactor.
export function parseAuthRedirect(
  responseUrl: string,
  expectedState: string,
): { ok: true; assertion: string } | { ok: false; kind: "invalid-redirect" | "state-mismatch" } {
  let parsed: URL;
  try {
    parsed = new URL(responseUrl);
  } catch {
    return { ok: false, kind: "invalid-redirect" };
  }
  const assertion = parsed.searchParams.get("assertion");
  const state = parsed.searchParams.get("state");
  if (!assertion || !state) {
    return { ok: false, kind: "invalid-redirect" };
  }
  if (state !== expectedState) {
    return { ok: false, kind: "state-mismatch" };
  }
  return { ok: true, assertion };
}

// Single source of truth for the connect flow's user-facing text, so background.ts's notification
// (the reliable channel, since the popup is expected to close mid-flow - see above) and popup.ts's
// inline status (a best-effort extra, shown only if the popup happens to survive) never drift into
// inconsistent wording for the same outcome.
export function describeConnectResult(result: ConnectResult): string {
  if (result.ok) {
    return "Connected to StudyLife.";
  }
  switch (result.kind) {
    case "invalid-url":
      return "Enter a valid server URL, e.g. https://studylife.example.com";
    case "permission-denied":
      return "Permission to access this server was denied - try connecting again and allow access when prompted.";
    case "cancelled":
      return "Connection cancelled.";
    case "auth-window-failed":
      return `Couldn't open StudyLife's login page: ${result.message}`;
    case "invalid-redirect":
      return "StudyLife's response was missing the expected data - try connecting again.";
    case "state-mismatch":
      return "Couldn't verify the connection response - try connecting again.";
    case "server-outdated":
      return "This StudyLife server doesn't support browser connect yet - update the server, then try again.";
    case "offline":
      return "You're offline - connect again once you're back online.";
    case "exchange-failed":
      return `Couldn't complete the connection: ${result.message}`;
  }
}

// Called from popup.ts inside the Connect button's own user gesture (permissions.request throws
// outside one) - requests access to exactly the one server origin being connected to, no broader
// host_permissions declared upfront (see manifest.json). Persists once granted, so this is a
// no-op on every later call unless the user points the extension at a different origin.
export async function requestHostPermission(origin: string): Promise<boolean> {
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

// Popup-death handoff for the connect flow: the host-permission prompt steals focus and closes
// the popup, killing its JS BETWEEN the user's grant and the sendMessage that would start the
// auth flow - the grant persists, but nothing continues (hit live: "grant, popup gone, reopen,
// click again"). So the popup stakes a pending-connect marker BEFORE prompting, and
// background.ts's chrome.permissions.onAdded listener takes it from there: grant lands -> the
// service worker consumes the marker and opens the auth window itself, popup survival not
// required. take* is consume-once and TTL-bound so a stale marker from an abandoned attempt
// can't fire minutes later on an unrelated permission grant.
const PENDING_CONNECT_KEY = "pendingConnect";
const PENDING_CONNECT_TTL_MS = 2 * 60 * 1000;

export async function setPendingConnect(serverUrl: string): Promise<void> {
  await chrome.storage.local.set({ [PENDING_CONNECT_KEY]: { serverUrl, ts: Date.now() } });
}

export async function clearPendingConnect(): Promise<void> {
  await chrome.storage.local.remove(PENDING_CONNECT_KEY);
}

// grantedOrigins: the origins of the permission grant that woke the caller - the marker is only
// consumed when it actually belongs to one of them, so an unrelated grant (e.g. for a different
// server origin) can neither trigger nor destroy a pending connect. A malformed or expired
// marker is always cleaned up.
export async function takePendingConnect(grantedOrigins: readonly string[]): Promise<string | null> {
  const stored = (await chrome.storage.local.get(PENDING_CONNECT_KEY))[PENDING_CONNECT_KEY] as
    | { serverUrl?: unknown; ts?: unknown }
    | undefined;
  if (!stored) return null;
  if (typeof stored.serverUrl !== "string" || typeof stored.ts !== "number"
      || Date.now() - stored.ts > PENDING_CONNECT_TTL_MS) {
    await chrome.storage.local.remove(PENDING_CONNECT_KEY);
    return null;
  }
  let origin: string;
  try {
    origin = `${new URL(stored.serverUrl).origin}/*`;
  } catch {
    await chrome.storage.local.remove(PENDING_CONNECT_KEY);
    return null;
  }
  if (!grantedOrigins.includes(origin)) return null;
  await chrome.storage.local.remove(PENDING_CONNECT_KEY);
  return stored.serverUrl;
}
