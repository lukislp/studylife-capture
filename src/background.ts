import { saveCapture } from "./api";
import { loadSettings } from "./settings";

const MENU_ID = "save-selection-to-studylife";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save to StudyLife",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  await captureSelection(info.selectionText, info.pageUrl, tab?.title ?? info.pageUrl);
});

async function captureSelection(selectionText: string, sourceUrl: string, title: string): Promise<void> {
  const settings = await loadSettings();
  if (!settings) {
    notify("StudyLife Capture", "Set your server URL and API key in the extension popup first.");
    return;
  }

  const result = await saveCapture(settings, {
    title,
    content: selectionText,
    sourceUrl,
  });

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
