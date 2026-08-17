const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcExamples = path.join(root, "examples");
const distExamples = path.join(root, "dist/examples");
const docsExamples = path.join(root, "docs/examples");

[distExamples, docsExamples].forEach((targetDir) => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
});

if (fs.existsSync(srcExamples)) {
  fs.readdirSync(srcExamples).forEach((file) => {
    const srcFile = path.join(srcExamples, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, path.join(distExamples, file));
      fs.copyFileSync(srcFile, path.join(docsExamples, file));
      fs.copyFileSync(srcFile, path.join(root, "dist", file));
      fs.copyFileSync(srcFile, path.join(root, "docs", file));
      fs.copyFileSync(srcFile, path.join(root, file));
    }
  });
  console.log("Copied examples to dist/examples, docs/examples, and root paths");
}
