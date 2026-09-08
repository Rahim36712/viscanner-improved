const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const sourceFilesDir = path.join(root, "examples/source_files");
const h2009Folder = "d:/internship/files/H2009_solution_1_HiScanner_plots_data";
const h2009Zip = "d:/internship/files/H2009_solution_1_HiScanner_plots_data.zip";

// Synchronize examples/source_files from H2009_solution_1_HiScanner_plots_data if available
if (fs.existsSync(h2009Folder)) {
  if (!fs.existsSync(sourceFilesDir)) {
    fs.mkdirSync(sourceFilesDir, { recursive: true });
  }
  // Clear any existing stale files in sourceFilesDir
  fs.readdirSync(sourceFilesDir).forEach((file) => {
    const fPath = path.join(sourceFilesDir, file);
    if (fs.statSync(fPath).isFile()) {
      fs.unlinkSync(fPath);
    }
  });
  // Copy all files from H2009 folder
  fs.readdirSync(h2009Folder).forEach((file) => {
    const src = path.join(h2009Folder, file);
    if (fs.statSync(src).isFile() && !file.endsWith(".zip")) {
      fs.copyFileSync(src, path.join(sourceFilesDir, file));
    }
  });
  console.log("Synchronized examples/source_files from:", h2009Folder);
}

// Also ensure the zip file is in examples/
if (fs.existsSync(h2009Zip)) {
  const destZip = path.join(root, "examples/H2009_solution_1_HiScanner_plots_data.zip");
  fs.copyFileSync(h2009Zip, destZip);
  console.log("Copied H2009_solution_1_HiScanner_plots_data.zip to examples/");
}

const sourceDir = fs.existsSync(sourceFilesDir) ? sourceFilesDir : h2009Folder;
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
