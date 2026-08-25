const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcExamples = path.join(root, "examples");
const distExamples = path.join(root, "dist/examples");

if (!fs.existsSync(distExamples)) {
  fs.mkdirSync(distExamples, { recursive: true });
}

if (fs.existsSync(srcExamples)) {
  fs.readdirSync(srcExamples).forEach((file) => {
    const srcFile = path.join(srcExamples, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, path.join(distExamples, file));
      fs.copyFileSync(srcFile, path.join(root, "dist", file));
    }
  });
  console.log("Copied examples to dist/examples and dist root");
}
