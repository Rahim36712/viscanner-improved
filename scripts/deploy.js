/**
 * deploy.js
 * 
 * Robust automated deployment script for ViScanner.
 * 
 * Ensures that all GitHub Pages source configurations (`gh-pages` branch, `/docs`, and root `/`)
 * have the latest production bundle committed and pushed across all remotes.
 */

const { execSync } = require("child_process");
const ghpages = require("gh-pages");
const path = require("path");
const fs = require("fs");

console.log("🚀 Starting automated deployment pipeline...");

// Step 0: Ensure exampleData module is freshly generated from source files
console.log("🔄 Generating exampleData module from source_files...");
execSync("node scripts/generate-example-data.js", { stdio: "inherit" });

// Step 1: Run production build
console.log("📦 Building production bundle (npm run build)...");
execSync("npm run build", { stdio: "inherit" });

// Step 2: Publish dist/ to gh-pages branch via direct git tree object
console.log("🌐 Publishing dist/ to gh-pages branch on GitHub...");
execSync("node scripts/publish-gh-pages.js", { stdio: "inherit" });

// Step 3: Copy dist files to docs/ and root for universal GitHub Pages compatibility
console.log("🔄 Syncing production build with root, docs/, and main branch...");
execSync("node scripts/sync-bundles.js", { stdio: "inherit" });

execSync("git add -A", { stdio: "inherit" });

const status = execSync("git status --porcelain", { encoding: "utf8" });
if (status) {
  console.log("📝 Committing updated production bundles and source files...");
  execSync('git commit -m "Deploy latest production build with updated example dataset [auto]"', { stdio: "inherit" });
}

console.log("🎉 Build and bundle sync complete! (No git push performed - push manually when ready)");
