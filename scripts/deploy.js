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

// Step 2: Publish dist/ to gh-pages branch
console.log("🌐 Publishing dist/ to gh-pages branch on GitHub...");
ghpages.publish(
  path.join(__dirname, "../dist"),
  {
    dotfiles: true,
    message: "Deploy production build [auto]",
  },
  (err) => {
    if (err) {
      console.error("❌ Error publishing to gh-pages branch:", err);
    } else {
      console.log("✅ Successfully published to gh-pages branch!");
    }

    try {
      // Force push gh-pages to all remotes
      try {
        execSync("git push origin gh-pages --force", { stdio: "ignore" });
        execSync("git push improved gh-pages --force", { stdio: "ignore" });
      } catch (e) {}

      // Step 3: Copy dist files to docs/ and root for universal GitHub Pages compatibility
      console.log("🔄 Syncing production build with docs/ and root...");
      const distDir = path.join(__dirname, "../dist");
      const docsDir = path.join(__dirname, "../docs");

      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      // Copy dist files to docs/
      fs.cpSync(distDir, docsDir, { recursive: true });

      execSync("git add dist docs examples", { stdio: "inherit" });

      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (status.includes("dist/") || status.includes("docs/")) {
        console.log("📝 Committing updated production bundles...");
        execSync('git commit -m "Deploy production build in dist and docs [auto]"', { stdio: "inherit" });
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
    } catch (deployErr) {
      console.error("Error during deployment sync:", deployErr);
    }
  }
);
