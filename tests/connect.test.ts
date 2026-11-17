import { beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeCaptureAssertion } from "../src/api";
import {
  buildConsentUrl,
  clearPendingConnect,
  newPkcePair,
  describeConnectResult,
  parseAuthRedirect,
  setPendingConnect,
  takePendingConnect,
  type ConnectResult,
} from "../src/connect";
import { createChromeStorageStub } from "./chrome-storage-stub";

const storage = createChromeStorageStub();

beforeEach(() => {
  storage.reset();
  storage.install();
});

describe("parseAuthRedirect", () => {
  const state = "abc123";

  it("returns the assertion for a valid redirect with matching state", () => {
    const result = parseAuthRedirect(
      `https://ext.chromiumapp.org/callback?assertion=tok&state=${state}`,
      state,
    );
    expect(result).toEqual({ ok: true, assertion: "tok" });
  });

  it("flags invalid-redirect when assertion is missing", () => {
    const result = parseAuthRedirect(`https://ext.chromiumapp.org/callback?state=${state}`, state);
    expect(result).toEqual({ ok: false, kind: "invalid-redirect" });
  });

  it("flags invalid-redirect when state is missing", () => {
    const result = parseAuthRedirect("https://ext.chromiumapp.org/callback?assertion=tok", state);
    expect(result).toEqual({ ok: false, kind: "invalid-redirect" });
  });

  it("flags state-mismatch when the state does not round-trip", () => {
    const result = parseAuthRedirect(
      `https://ext.chromiumapp.org/callback?assertion=tok&state=wrong`,
      state,
    );
    expect(result).toEqual({ ok: false, kind: "state-mismatch" });
  });

  it("flags invalid-redirect for an unparseable URL", () => {
    const result = parseAuthRedirect("not a url", state);
    expect(result).toEqual({ ok: false, kind: "invalid-redirect" });
  });

  it("tolerates extra query params", () => {
    const result = parseAuthRedirect(
      `https://ext.chromiumapp.org/callback?assertion=tok&state=${state}&extra=1&another=x`,
      state,
    );
    expect(result).toEqual({ ok: true, assertion: "tok" });
  });
});

describe("describeConnectResult", () => {
  const allResults: ConnectResult[] = [
    { ok: true, serverUrl: "https://example.com" },
    { ok: false, kind: "invalid-url" },
    { ok: false, kind: "permission-denied" },
    { ok: false, kind: "cancelled" },
    { ok: false, kind: "auth-window-failed", message: "boom" },
    { ok: false, kind: "invalid-redirect" },
    { ok: false, kind: "state-mismatch" },
    { ok: false, kind: "server-outdated" },
    { ok: false, kind: "offline" },
    { ok: false, kind: "exchange-failed", message: "boom" },
  ];

  it.each(allResults)("returns a non-empty string for every ConnectResult kind", (result) => {
    expect(describeConnectResult(result).length).toBeGreaterThan(0);
  });

  it("returns the exact connected message", () => {
    expect(describeConnectResult({ ok: true, serverUrl: "https://x" })).toBe("Connected to StudyAtrium.");
  });

  it("returns the exact cancelled message", () => {
    expect(describeConnectResult({ ok: false, kind: "cancelled" })).toBe("Connection cancelled.");
  });

  it("includes the underlying message for exchange-failed", () => {
    expect(
      describeConnectResult({ ok: false, kind: "exchange-failed", message: "network down" }),
    ).toBe("Couldn't complete the connection: network down");
  });
});

describe("pending connect marker", () => {
  const serverUrl = "https://studylife.example.com";
  const origin = "https://studylife.example.com/*";

  it("round-trips through set -> take with a matching granted origin", async () => {
    await setPendingConnect(serverUrl);
    await expect(takePendingConnect([origin])).resolves.toBe(serverUrl);
  });

  it("returns null and leaves the marker when granted origins don't match", async () => {
    await setPendingConnect(serverUrl);
    await expect(takePendingConnect(["https://other.example.com/*"])).resolves.toBeNull();
    // Marker survives the non-matching take - a later take with the right origin still works.
    await expect(takePendingConnect([origin])).resolves.toBe(serverUrl);
  });

  it("returns null and cleans up an expired marker", async () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      vi.setSystemTime(start);
      await setPendingConnect(serverUrl);
      vi.setSystemTime(start + 2 * 60 * 1000 + 1); // just past the 2-minute TTL
      await expect(takePendingConnect([origin])).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
    expect(storage.raw().pendingConnect).toBeUndefined();
  });

  it("returns null and cleans up a malformed marker", async () => {
    storage.raw().pendingConnect = { serverUrl: 123, ts: "not-a-number" };
    await expect(takePendingConnect([origin])).resolves.toBeNull();
    expect(storage.raw().pendingConnect).toBeUndefined();
  });

  it("returns null on a second take after the marker was already consumed", async () => {
    await setPendingConnect(serverUrl);
    await takePendingConnect([origin]);
    await expect(takePendingConnect([origin])).resolves.toBeNull();
  });

  it("clearPendingConnect removes the marker outright", async () => {
    await setPendingConnect(serverUrl);
    await clearPendingConnect();
    await expect(takePendingConnect([origin])).resolves.toBeNull();
  });
});

describe("PKCE", () => {
  const b64url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  it("creates a verifier of unreserved characters whose challenge is base64url SHA-256", async () => {
    const { verifier, challenge } = await newPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    expect(challenge).toBe(b64url(new Uint8Array(digest)));
  });

  it("matches the RFC 7636 appendix B test vector shape (no padding)", async () => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    );
    expect(b64url(new Uint8Array(digest))).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates a fresh verifier per attempt", async () => {
    const a = await newPkcePair();
    const b = await newPkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });

  it("puts code_challenge and code_challenge_method=S256 on the consent URL", () => {
    const url = new URL(buildConsentUrl("https://srv.example", "https://ext.chromiumapp.org/", "st", "chal"));
    expect(url.pathname).toBe("/connect/capture");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("https://ext.chromiumapp.org/");
  });

  it("sends codeVerifier in the exchange body and never persists the verifier", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ captureApiKey: "k", userId: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { verifier } = await newPkcePair();
    const result = await exchangeCaptureAssertion("https://srv.example", "asrt", verifier);
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://srv.example/api/auth/capture-assertion-exchange");
    expect(JSON.parse(init.body as string)).toEqual({ assertion: "asrt", codeVerifier: verifier });
    expect(JSON.stringify(storage)).not.toContain(verifier);
    vi.unstubAllGlobals();
  });
});
