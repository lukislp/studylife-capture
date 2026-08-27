import { beforeEach, describe, expect, it } from "vitest";
import { loadSettings, loadStoredSettings, normalizeServerUrl, saveSettings } from "../src/settings";
import { createChromeStorageStub } from "./chrome-storage-stub";

const storage = createChromeStorageStub();

beforeEach(() => {
  storage.reset();
  storage.install();
});

describe("normalizeServerUrl", () => {
  it("strips a single trailing slash", () => {
    expect(normalizeServerUrl("https://studylife.example.com/")).toBe("https://studylife.example.com");
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizeServerUrl("https://studylife.example.com///")).toBe("https://studylife.example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeServerUrl("  https://studylife.example.com  ")).toBe("https://studylife.example.com");
  });

  it("leaves a plain URL with no trailing slash unchanged", () => {
    expect(normalizeServerUrl("https://studylife.example.com")).toBe("https://studylife.example.com");
  });
});

describe("loadStoredSettings vs loadSettings", () => {
  it("returns a URL-only draft from loadStoredSettings but null from loadSettings", async () => {
    await saveSettings({ serverUrl: "https://studylife.example.com", apiKey: "" });
    await expect(loadStoredSettings()).resolves.toEqual({
      serverUrl: "https://studylife.example.com",
      apiKey: "",
    });
    await expect(loadSettings()).resolves.toBeNull();
  });

  it("returns full settings from both once an apiKey is present", async () => {
    const settings = { serverUrl: "https://studylife.example.com", apiKey: "secret" };
    await saveSettings(settings);
    await expect(loadStoredSettings()).resolves.toEqual(settings);
    await expect(loadSettings()).resolves.toEqual(settings);
  });

  it("returns null from both when nothing is stored", async () => {
    await expect(loadStoredSettings()).resolves.toBeNull();
    await expect(loadSettings()).resolves.toBeNull();
  });
});
