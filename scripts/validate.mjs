import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const js = readFileSync("js/script.js", "utf8");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) {
  throw new Error("Duplicate HTML ids: " + [...new Set(duplicateIds)].join(", "));
}

const referencedIds = [...js.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds.filter((id) => !ids.includes(id)))];
if (missingIds.length) {
  throw new Error("JavaScript references missing HTML ids: " + missingIds.join(", "));
}

new Function(js);

for (const required of [
  "analyzeHandwritingStyle",
  "detectPageLayout",
  "buildPages",
  "generatePreview",
  "resetBtn.addEventListener",
  "downloadBtn.addEventListener"
]) {
  if (!js.includes(required)) throw new Error("Missing expected app feature: " + required);
}

if (html.includes("downloadSheetBtn") || js.includes("CALIBRATION_CHARS")) {
  throw new Error("Obsolete handwriting calibration-sheet flow detected.");
}

console.log("Humanly AI validation passed: JavaScript syntax, HTML references, and core features.");
