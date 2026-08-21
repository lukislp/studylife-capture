import { saveCapture } from "./api";
import { loadSettings } from "./settings";

const SELECTION_MENU_ID = "save-selection-to-studylife";
const ARTICLE_MENU_ID = "save-article-to-studylife";
// Matches article-extractor.ts's message shape exactly - kept in sync manually since the two
// files can't share a type import (article-extractor.js is injected as a standalone bundle
// into the page, not part of this service worker's module graph).
const ARTICLE_EXTRACTED_MESSAGE = "studylife-capture:article-extracted";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: SELECTION_MENU_ID,
    title: "Save selection to StudyLife",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: ARTICLE_MENU_ID,
    title: "Save full article to StudyLife",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === SELECTION_MENU_ID && info.selectionText) {
    await capture(tab?.title ?? info.pageUrl, info.selectionText, info.pageUrl);
    return;
  }
  if (info.menuItemId === ARTICLE_MENU_ID) {
    await extractAndCaptureArticle(tab);
  }
});

// Readability needs a real DOM (document.cloneNode, computed styles for visibility scoring) -
// unavailable in this service worker, so the actual parsing runs injected into the page itself
// (article-extractor.ts) and reports back via chrome.runtime.onMessage below.
async function extractAndCaptureArticle(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["article-extractor.js"] });
  } catch (error) {
    notify(
      "StudyLife Capture failed",
      `Could not read this page: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (typeof message !== "object" || message === null || (message as { type?: unknown }).type !== ARTICLE_EXTRACTED_MESSAGE) {
    return;
  }
  const { title, content, error } = message as { title?: string; content?: string; error?: string };
  if (error) {
    notify("StudyLife Capture failed", error);
    return;
  }
  void capture(title ?? sender.tab?.title ?? "Untitled", content ?? "", sender.tab?.url ?? "");
});

async function capture(title: string, content: string, sourceUrl: string): Promise<void> {
  const settings = await loadSettings();
  if (!settings) {
    notify("StudyLife Capture", "Set your server URL and API key in the extension popup first.");
    return;
  }

  const result = await saveCapture(settings, { title, content, sourceUrl });

  if (result.ok) {
    notify("Saved to StudyLife", title);
  } else {
    const detail = result.status ? `HTTP ${result.status}` : "network error";
    notify("StudyLife Capture failed", `${detail}: ${result.message}`.slice(0, 200));
  }
}

function notify(title: string, message: string): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message,
  });
}
