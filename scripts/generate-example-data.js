const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const folesDir = path.join(root, "examples/source_files");
const fallbackDir = "d:/internship/files/foles";

const sourceDir = fs.existsSync(folesDir) ? folesDir : fallbackDir;
console.log("Reading example data source files from:", sourceDir);

const entryTexts = {};
const availableFiles = fs.readdirSync(sourceDir).filter((file) => {
  const filePath = path.join(sourceDir, file);
  return fs.statSync(filePath).isFile() && !file.endsWith(".zip");
});

availableFiles.forEach((file) => {
  const filePath = path.join(sourceDir, file);
  entryTexts[file] = fs.readFileSync(filePath, "utf8");
  console.log(`Loaded ${file} (${(entryTexts[file].length / 1024).toFixed(1)} KB)`);
});

// JSON stringify and gzip
const jsonStr = JSON.stringify(entryTexts);
const gzipped = zlib.gzipSync(Buffer.from(jsonStr, "utf8"));
const base64Gzip = gzipped.toString("base64");

console.log(`Compressed size: ${(gzipped.length / 1024).toFixed(1)} KB (Base64: ${(base64Gzip.length / 1024).toFixed(1)} KB)`);

const moduleContent = `/**
 * exampleData.js
 *
 * Pre-packaged Wakhan visualization dataset for instant, standalone example loading.
 * Stored as a lazy-loaded compressed module to prevent browser download manager (e.g. IDM)
 * interceptions and ensure 100% reliable execution worldwide.
 */

import pako from "pako";

const COMPRESSED_DATA = "${base64Gzip}";

function base64ToUint8Array(base64) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64");
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function getExampleEntryTexts() {
  const bytes = base64ToUint8Array(COMPRESSED_DATA);
  const decompressed = pako.ungzip(bytes, { to: "string" });
  return JSON.parse(decompressed);
}
`;

fs.writeFileSync(path.join(root, "src/exampleData.js"), moduleContent, "utf8");
console.log("Updated src/exampleData.js successfully!");
