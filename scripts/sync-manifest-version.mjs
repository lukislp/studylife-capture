// Keeps manifest.json's own "version" field (the one Chrome/the Web Store actually reads) in
// sync with the version the release workflow publishes (and writes into package.json) - the two
// are independent files with no automatic link, same reason the HACS integrations sync their own
// manifest.json's version this way. Called from the publish-assets job of ci.yml before the
// release zip is built, so the zip carries the released version.
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/sync-manifest-version.mjs <version>");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json version set to ${version}`);
