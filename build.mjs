// Bundles the extension's TS entry points into dist/ and copies the static
// files (manifest, popup HTML/CSS) alongside them - dist/ is what gets
// loaded unpacked in chrome://extensions or zipped for the Web Store.
import { build, context } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });

const entryPoints = ["src/background.ts", "src/popup.ts"];
const buildOptions = {
  entryPoints,
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "chrome120",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
};

function copyStaticFiles() {
  copyFileSync("manifest.json", "dist/manifest.json");
  copyFileSync("src/popup.html", "dist/popup.html");
  copyFileSync("src/popup.css", "dist/popup.css");
  for (const size of [16, 48, 128]) {
    copyFileSync(`src/icon${size}.png`, `dist/icon${size}.png`);
  }
}

if (watch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  copyStaticFiles();
  console.log("Watching for changes...");
} else {
  await build(buildOptions);
  copyStaticFiles();
  console.log("Built to dist/");
}
