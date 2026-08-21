import { Readability } from "@mozilla/readability";

const MESSAGE_TYPE = "studylife-capture:article-extracted";

// Injected via chrome.scripting.executeScript({files: ["article-extractor.js"]}) into the
// active tab - runs in the PAGE's own context (Readability needs the real DOM), not the
// extension's service worker (which has no document). Reports back to background.ts via
// runtime messaging rather than relying on executeScript's return-value semantics, which only
// capture the last top-level expression's value and are easy to break silently on any future
// refactor of this file.
(function extractArticle(): void {
  try {
    // Readability mutates the document it's given (strips elements while scoring them) - clone
    // so the actual page the user is looking at is never altered.
    const article = new Readability(document.cloneNode(true) as Document).parse();
    if (!article || !article.textContent?.trim()) {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPE, error: "No article content found on this page." });
      return;
    }
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPE,
      title: article.title || document.title,
      content: article.textContent.trim(),
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPE,
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();
