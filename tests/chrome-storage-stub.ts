// Minimal in-memory stand-in for chrome.storage.local - just enough surface (get/set/remove,
// each keyed by a single string) for connect.ts's pending-connect marker and settings.ts's
// settings record, the only chrome.storage.local callers under test here. Cast through
// `unknown` when assigning to globalThis.chrome since @types/chrome's StorageArea type is far
// wider than what these two modules actually call - a full mock would just be noise.
export function createChromeStorageStub() {
  let store: Record<string, unknown> = {};
  const api = {
    get: async (key: string) => ({ [key]: store[key] }),
    set: async (items: Record<string, unknown>) => {
      store = { ...store, ...items };
    },
    remove: async (key: string) => {
      delete store[key];
    },
  };
  return {
    raw: () => store,
    reset: () => {
      store = {};
    },
    install: () => {
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: { local: api },
      };
    },
  };
}
