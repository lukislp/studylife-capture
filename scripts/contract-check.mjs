// Guards against StudyLife's server-side NoteDto drifting out from under this extension's
// hand-mirrored NoteDtoPayload (src/api.ts) without anyone noticing until a Web Store review
// finally lets the drifted build reach users - by then a fix is days away, not minutes. Diffs
// the payload fields this extension actually sends against the main repo's committed OpenAPI
// spec (docs/api/openapi.json) and confirms the /api/notes routes it calls still exist.
//
// Plain Node, no new dependencies: the field list is parsed out of src/api.ts's source text by
// regex rather than importing it (Node has no built-in TS loader here, and adding one just for
// this check isn't worth it), and the spec is loaded with the global fetch/fs already available
// in Node 22.
import { existsSync, readFileSync } from "node:fs";

const API_TS_PATH = new URL("../src/api.ts", import.meta.url);
const NOTES_PATH = "/api/notes";
// Only the JSON API endpoint is checked here, not GET /connect/capture - that's a browser-rendered
// passkey login/consent page (see api.ts's exchangeCaptureAssertion doc comment), not a JSON API
// route, so ASP.NET Core's Swagger generator has no reason to ever list it in the OpenAPI spec.
// Checking for it here would just be permanently red, not "red until the server PR merges".
const ASSERTION_EXCHANGE_PATH = "/api/auth/capture-assertion-exchange";
const DEFAULT_SPEC_SOURCE = "https://raw.githubusercontent.com/lukislp/studylife/main/docs/api/openapi.json";

async function main() {
  const specSource = process.env.STUDYLIFE_OPENAPI_SPEC || DEFAULT_SPEC_SOURCE;
  const payloadFields = readPayloadFields();
  console.log(`Checking ${payloadFields.length} NoteDtoPayload field(s) against ${specSource}`);

  const spec = await loadSpec(specSource);

  const errors = [];
  errors.push(...checkNotesRoutesExist(spec));
  errors.push(...checkPayloadFieldsExist(spec, payloadFields));
  errors.push(...checkAssertionExchangeRouteExists(spec));

  if (errors.length > 0) {
    console.error("\nContract check FAILED - the extension's NoteDto payload has drifted from the API spec:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error(`\nSource of truth: ${specSource}`);
    process.exit(1);
  }

  console.log("Contract check passed: /api/notes routes and NoteDtoPayload fields all match the spec.");
}

// Parses `export const NOTE_PAYLOAD_FIELDS = [...] as const satisfies ...;` out of src/api.ts's
// source text. Deliberately a plain regex, not a TS parser, to keep this script dependency-free -
// if the const's shape ever changes enough to break this, the "no field names found" error below
// points straight at the mismatch.
function readPayloadFields() {
  const source = readFileSync(API_TS_PATH, "utf-8");
  const match = source.match(/NOTE_PAYLOAD_FIELDS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) {
    console.error(`Could not find NOTE_PAYLOAD_FIELDS in ${API_TS_PATH.pathname}`);
    process.exit(1);
  }
  const fields = [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  if (fields.length === 0) {
    console.error(`Found NOTE_PAYLOAD_FIELDS in ${API_TS_PATH.pathname} but parsed zero field names out of it.`);
    process.exit(1);
  }
  return fields;
}

// `source` is a file path (resolved relative to the current working directory, i.e. the repo
// root when run via `npm run contract-check`) unless it looks like a URL.
async function loadSpec(source) {
  const isUrl = /^https?:\/\//i.test(source);
  let text;
  try {
    if (isUrl) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      text = await response.text();
    } else {
      if (!existsSync(source)) {
        throw new Error("file not found");
      }
      text = readFileSync(source, "utf-8");
    }
  } catch (error) {
    console.error(`Could not load the OpenAPI spec from ${source}: ${error.message}`);
    process.exit(1);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`OpenAPI spec at ${source} is not valid JSON: ${error.message}`);
    process.exit(1);
  }
}

function checkNotesRoutesExist(spec) {
  const errors = [];
  const pathItem = spec?.paths?.[NOTES_PATH];
  if (!pathItem) {
    errors.push(`Spec has no "${NOTES_PATH}" path at all (expected both GET and POST).`);
    return errors;
  }
  if (!pathItem.post) {
    errors.push(`Spec is missing POST ${NOTES_PATH} (saveCapture() depends on it).`);
  }
  if (!pathItem.get) {
    errors.push(`Spec is missing GET ${NOTES_PATH} (testConnection() depends on it).`);
  }
  return errors;
}

// Guards the browser-connect flow's exchange call (src/api.ts's exchangeCaptureAssertion) the
// same way checkNotesRoutesExist() guards saveCapture()/testConnection() - fails loudly here
// instead of only surfacing as a 404 once a build reaches users. Ships ahead of the server PR that
// adds this endpoint (studylife's own repo), so this is EXPECTED to fail CI until that PR merges
// and docs/api/openapi.json picks up the new route - not a bug in this check.
function checkAssertionExchangeRouteExists(spec) {
  const pathItem = spec?.paths?.[ASSERTION_EXCHANGE_PATH];
  if (!pathItem) {
    return [`Spec has no "${ASSERTION_EXCHANGE_PATH}" path (expected POST, used by the browser-connect flow).`];
  }
  if (!pathItem.post) {
    return [`Spec is missing POST ${ASSERTION_EXCHANGE_PATH} (exchangeCaptureAssertion() depends on it).`];
  }
  return [];
}

function checkPayloadFieldsExist(spec, payloadFields) {
  const schema = findNoteDtoSchema(spec);
  if (!schema) {
    return [`Spec has no "NoteDto" component schema (checked components.schemas for an exact or suffix match).`];
  }

  const specFields = new Set(Object.keys(schema.properties ?? {}));
  const errors = [];
  for (const field of payloadFields) {
    if (!specFields.has(field)) {
      errors.push(
        `NoteDtoPayload sends "${field}", but the spec's NoteDto schema has no such property (drift or rename?).`,
      );
    }
  }
  return errors;
}

// The schema key may be the bare "NoteDto" or a fully-qualified name like
// "StudyLifeSharedDtosNoteDto" depending on how the generator names components - try an exact
// match first, then fall back to any key ending in "NoteDto".
function findNoteDtoSchema(spec) {
  const schemas = spec?.components?.schemas;
  if (!schemas) return undefined;
  if (schemas.NoteDto) return schemas.NoteDto;
  const suffixKey = Object.keys(schemas).find((key) => key !== "NoteDto" && /NoteDto$/.test(key));
  return suffixKey ? schemas[suffixKey] : undefined;
}

main().catch((error) => {
  console.error("Contract check crashed unexpectedly:", error);
  process.exit(1);
});
