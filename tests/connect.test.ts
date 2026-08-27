import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingConnect,
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
    expect(describeConnectResult({ ok: true, serverUrl: "https://x" })).toBe("Connected to StudyLife.");
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
