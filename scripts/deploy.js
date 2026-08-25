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

// Step 2: Copy dist files to docs/ and root, and clean stale bundles
console.log("🔄 Syncing production build with root, docs/, and main branch...");
execSync("node scripts/sync-bundles.js", { stdio: "inherit" });

// Step 3: Stage all changes
console.log("📦 Staging updated files...");
execSync("git add -A", { stdio: "inherit" });

// Step 4: Publish dist/ to gh-pages branch via direct git tree object
console.log("🌐 Updating local gh-pages branch...");
execSync("node scripts/publish-gh-pages.js", { stdio: "inherit" });

// Step 5: Commit changes to main if any
const status = execSync("git status --porcelain", { encoding: "utf8" });
if (status) {
  console.log("📝 Committing updated production bundles and source files...");
  execSync('git commit -m "Deploy latest production build with updated example dataset [auto]"', { stdio: "inherit" });
}

// Step 6: Push main and gh-pages to all remotes
const remotes = execSync("git remote", { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
remotes.forEach((remote) => {
  console.log(`🚀 Pushing main and gh-pages to remote: ${remote}...`);
  try {
    execSync(`git push ${remote} main`, { stdio: "inherit" });
  } catch (err) {
    console.warn(`Warning: Failed to push main to ${remote}:`, err.message);
  }
  try {
    execSync(`git push ${remote} gh-pages --force`, { stdio: "inherit" });
  } catch (err) {
    console.warn(`Warning: Failed to push gh-pages to ${remote}:`, err.message);
  }
});

console.log("🎉 Complete automated deployment finished successfully!");
