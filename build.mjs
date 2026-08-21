// Bundles the extension's TS entry points into dist/ and copies the static
// files (manifest, popup HTML/CSS) alongside them - dist/ is what gets
// loaded unpacked in chrome://extensions or zipped for the Web Store.
import { build, context } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });

const sharedOptions = {
  bundle: true,
  outdir: "dist",
  target: "chrome120",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
};

// Service worker + popup: real ES modules (manifest.json declares "type": "module" for the
// background script; popup.html loads popup.js the same way).
const moduleBuildOptions = { ...sharedOptions, entryPoints: ["src/background.ts", "src/popup.ts"], format: "esm" };

// article-extractor.ts is injected into a page via chrome.scripting.executeScript({files: [...]})
// as a classic script, not loaded as a module - "iife" so Readability's import gets inlined
// into one self-contained file with no import statement left for the page to fail to resolve.
const articleExtractorBuildOptions = {
  ...sharedOptions,
  entryPoints: ["src/article-extractor.ts"],
  format: "iife",
};

function copyStaticFiles() {
  copyFileSync("manifest.json", "dist/manifest.json");
  copyFileSync("src/popup.html", "dist/popup.html");
  copyFileSync("src/popup.css", "dist/popup.css");
  for (const size of [16, 48, 128]) {
    copyFileSync(`src/icon${size}.png`, `dist/icon${size}.png`);
  }
  // Self-hosted DM Sans (see popup.css) - the actual font files plus their SIL Open Font
  // License text, redistributed alongside them as the license requires.
  mkdirSync("dist/fonts", { recursive: true });
  for (const file of ["dm-sans-latin.woff2", "dm-sans-latin-ext.woff2", "OFL.txt"]) {
    copyFileSync(`src/fonts/${file}`, `dist/fonts/${file}`);
  }
}

if (watch) {
  const [moduleCtx, articleCtx] = await Promise.all([
    context(moduleBuildOptions),
    context(articleExtractorBuildOptions),
  ]);
  await Promise.all([moduleCtx.watch(), articleCtx.watch()]);
  copyStaticFiles();
  console.log("Watching for changes...");
} else {
  await Promise.all([build(moduleBuildOptions), build(articleExtractorBuildOptions)]);
  copyStaticFiles();
  console.log("Built to dist/");
}
