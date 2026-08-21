// Packages the already-built dist/ into a single .zip at the repo root - the artifact format
// the Chrome Web Store dashboard accepts on upload, and a convenient download for anyone
// installing manually (unzip, then "Load unpacked" in chrome://extensions/, dev mode on).
// Zips dist/'s CONTENTS at the archive root (not a wrapping "dist/" folder inside the zip) -
// the Web Store requires manifest.json to sit at the top level of the archive.
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { ZipArchive } from "archiver";

if (!existsSync("dist")) {
  console.error("dist/ not found - run `npm run build` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf-8"));
mkdirSync("release", { recursive: true });
const outputPath = `release/studylife-capture-v${manifest.version}.zip`;

const output = createWriteStream(outputPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on("close", () => {
  console.log(`Packaged ${outputPath} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
});
archive.on("error", (error) => {
  throw error;
});

archive.pipe(output);
archive.directory("dist/", false);
await archive.finalize();
