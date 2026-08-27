import { defineConfig } from "vitest/config";

// Tests live in tests/, outside src/, on purpose: tsconfig.json's "include": ["src"] keeps
// them out of `npm run typecheck` and build.mjs's esbuild bundle (which lists its own
// entryPoints explicitly anyway), so this file only needs to point vitest at that directory -
// no bundler-specific transforms or DOM globals are needed since everything under test is a
// plain, chrome-free function with chrome.* itself stubbed per test file.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
