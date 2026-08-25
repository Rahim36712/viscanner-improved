const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const docs = path.join(root, "docs");

const indexHtml = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const match = indexHtml.match(/src="([^"]+)"/);
if (!match) {
  throw new Error("Could not find script src in dist/index.html");
}

const mainBundleName = match[1];
console.log("Main bundle name:", mainBundleName);

const distFiles = new Set(fs.readdirSync(dist));

// Clean up stale bundle files in root and docs that are no longer in dist
[root, docs].forEach((targetDir) => {
  if (fs.existsSync(targetDir)) {
    fs.readdirSync(targetDir).forEach((file) => {
      if (file.startsWith("bundle.") && file !== "bundle.js" && !distFiles.has(file)) {
        try {
          fs.unlinkSync(path.join(targetDir, file));
          console.log(`Removed stale bundle: ${path.relative(root, path.join(targetDir, file))}`);
        } catch (e) {}
      }
    });
  }
});

const mainBundlePath = path.join(dist, mainBundleName);

// Copy main bundle to bundle.js in root, dist, and docs
fs.copyFileSync(mainBundlePath, path.join(root, "bundle.js"));
fs.copyFileSync(mainBundlePath, path.join(dist, "bundle.js"));
fs.copyFileSync(mainBundlePath, path.join(docs, "bundle.js"));

// Copy index.html and all dist files to docs and root
fs.copyFileSync(path.join(dist, "index.html"), path.join(root, "index.html"));
fs.copyFileSync(path.join(dist, "index.html"), path.join(docs, "index.html"));

fs.readdirSync(dist).forEach((file) => {
  const src = path.join(dist, file);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(root, file));
    fs.copyFileSync(src, path.join(docs, file));
  }
});

console.log("Successfully synchronized main bundle to bundle.js, root, docs, and dist!");
