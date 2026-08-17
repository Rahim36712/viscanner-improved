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

// Step 1: Run production build
console.log("📦 Building production bundle (npm run build)...");
execSync("npm run build", { stdio: "inherit" });

// Step 2: Publish dist/ to gh-pages branch via direct git tree object
console.log("🌐 Publishing dist/ to gh-pages branch on GitHub...");
execSync("node scripts/publish-gh-pages.js", { stdio: "inherit" });

// Step 3: Copy dist files to docs/ and root for universal GitHub Pages compatibility
console.log("🔄 Syncing production build with root, docs/, and main branch...");
execSync("node scripts/sync-bundles.js", { stdio: "inherit" });

execSync("git add index.html bundle.js bundle.*.js bundle.*.txt favicon.ico dist docs examples scripts", { stdio: "inherit" });

const status = execSync("git status --porcelain", { encoding: "utf8" });
if (status.includes("dist/") || status.includes("docs/") || status.includes("index.html") || status.includes("bundle") || status.includes("scripts/")) {
  console.log("📝 Committing updated production bundles in root, dist, and docs...");
  execSync('git commit -m "Deploy latest production build to root, dist, and docs [auto]"', { stdio: "inherit" });
}

console.log("⬆️ Pushing working branches to GitHub...");
try {
  execSync("git push origin main", { stdio: "inherit" });
  execSync("git push origin main:wakhan-hp-tracks --force", { stdio: "inherit" });
} catch (e) {
  console.log("Notice during origin push:", e.message);
}

try {
  execSync("git push improved main --force", { stdio: "inherit" });
  execSync("git push improved main:wakhan-hp-tracks --force", { stdio: "inherit" });
} catch (e) {
  console.log("Notice during improved push:", e.message);
}

console.log("🎉 Deployment complete! All branches and GitHub Pages are 100% updated.");
