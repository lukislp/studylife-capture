// Property-based tests (fast-check) for the two pure input parsers: normalizeServerUrl takes
// whatever a user pastes as the server address, parseAuthRedirect takes the callback URL the
// browser hands back from the connect flow. Both must be total functions (never throw), and
// parseAuthRedirect must only ever succeed when the state round-trips exactly.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseAuthRedirect } from "../src/connect";
import { normalizeServerUrl } from "../src/settings";

// Plain letter/digit labels only: a label like "xn--" is an (invalid) punycode form and a
// trailing hyphen is not a valid hostname either - both would be generator bugs, not parser bugs.
const hostname = fc.stringMatching(/^[a-z][a-z0-9]{0,20}(\.[a-z][a-z0-9]{0,10}){1,3}$/);
const token = fc.stringMatching(/^[A-Za-z0-9._~-]{1,64}$/);

describe("normalizeServerUrl (property-based)", () => {
  it("never throws and is idempotent", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (raw) => {
        const once = normalizeServerUrl(raw);
        expect(typeof once).toBe("string");
        expect(normalizeServerUrl(once)).toBe(once);
      }),
      { numRuns: 2000 },
    );
  });

  it("only ever removes trailing slashes, and removes all of them", () => {
    fc.assert(
      fc.property(
        // A base with no trailing whitespace or slashes left, so appending slashes is the only
        // thing normalizeServerUrl has to undo.
        fc.string({ maxLength: 120 }).map((s) => s.trim().replace(/[\s/]+$/, "")),
        fc.integer({ min: 0, max: 5 }),
        (base, slashes) => {
          const normalized = normalizeServerUrl(`${base}${"/".repeat(slashes)}`);
          expect(normalized).toBe(base);
          expect(normalized.endsWith("/")).toBe(false);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe("parseAuthRedirect (property-based)", () => {
  it("never throws, whatever URL and state it is given", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), fc.string({ maxLength: 64 }), (url, state) => {
        const result = parseAuthRedirect(url, state);
        expect(typeof result.ok).toBe("boolean");
      }),
      { numRuns: 2000 },
    );
  });

  it("accepts exactly the redirects whose state matches, and returns their assertion", () => {
    fc.assert(
      fc.property(hostname, token, token, token, (host, assertion, state, otherState) => {
        const url = `https://${host}/callback?assertion=${assertion}&state=${state}`;
        expect(parseAuthRedirect(url, state)).toEqual({ ok: true, assertion });
        if (otherState !== state) {
          expect(parseAuthRedirect(url, otherState)).toEqual({ ok: false, kind: "state-mismatch" });
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("rejects a redirect that lacks the assertion or the state", () => {
    fc.assert(
      fc.property(hostname, token, fc.constantFrom("assertion", "state"), (host, value, onlyParam) => {
        const url = `https://${host}/callback?${onlyParam}=${value}`;
        expect(parseAuthRedirect(url, value)).toEqual({ ok: false, kind: "invalid-redirect" });
      }),
      { numRuns: 500 },
    );
  });
});
