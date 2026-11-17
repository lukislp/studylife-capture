// Fails on high/critical `npm audit` findings, except the advisories allowlisted below.
// Replaces a plain `npm audit --audit-level=high` while an advisory has no upstream fix.
import { spawnSync } from "node:child_process";

// TODO: remove once picomatch publishes a patched release (micromatch/picomatch#194).
const ALLOWED = new Set(["GHSA-fc5q-39xc-vjpf"]);
const BLOCKING = new Set(["high", "critical"]);

const run = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error("npm audit did not return JSON:\n" + (run.stderr || run.stdout));
  process.exit(1);
}
if (report.error) {
  console.error("npm audit failed: " + JSON.stringify(report.error));
  process.exit(1);
}

const vulns = report.vulnerabilities ?? {};
// An advisory object in `via` is a root cause; strings name a package that is only
// affected transitively. A package is blocking when any of its own advisories is
// blocking and not allowlisted, and a transitive package is judged by its causes.
const causes = (name, seen = new Set()) => {
  if (seen.has(name)) return [];
  seen.add(name);
  const v = vulns[name];
  if (!v) return [];
  return v.via.flatMap((x) => (typeof x === "string" ? causes(x, seen) : [x]));
};

const blocking = new Map();
for (const name of Object.keys(vulns)) {
  for (const adv of causes(name)) {
    const id = (adv.url ?? "").split("/").pop();
    if (BLOCKING.has(adv.severity) && !ALLOWED.has(id)) blocking.set(id || adv.title, adv);
  }
}

const allowedHits = new Set();
for (const name of Object.keys(vulns))
  for (const adv of causes(name)) {
    const id = (adv.url ?? "").split("/").pop();
    if (ALLOWED.has(id)) allowedHits.add(id);
  }
for (const id of allowedHits) console.log(`allowlisted advisory still present: ${id}`);

if (blocking.size) {
  for (const [id, a] of blocking) console.error(`${a.severity}: ${a.name} ${a.title} (${id})`);
  process.exit(1);
}
console.log("npm audit: no high/critical findings outside the allowlist");
