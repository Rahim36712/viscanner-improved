/**
 * deploy.js
 * 
 * Robust automated deployment script for ViScanner.
 * 
 * Ensures that both `gh-pages` branch AND the main/working branch (`wakhan-hp-tracks`)
 * have the latest production `dist/` bundle committed and pushed to GitHub.
 */

const { execSync } = require("child_process");
const ghpages = require("gh-pages");
const path = require("path");

console.log("🚀 Starting automated deployment pipeline...");

// Step 1: Run production build
console.log("📦 Building production bundle (npm run build)...");
execSync("npm run build", { stdio: "inherit" });

// Step 2: Publish dist to gh-pages branch
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

    // Step 3: Stage dist and current changes on working branch & push
    try {
      console.log("🔄 Syncing dist/ with current working branch...");
      execSync("git add dist", { stdio: "inherit" });
      
      const status = execSync("git status --porcelain", { encoding: "utf8" });
      if (status.includes("dist/")) {
        console.log("📝 Committing updated dist/ bundle...");
        execSync('git commit -m "Deploy production build in dist [auto]"', { stdio: "inherit" });
      }

      console.log("⬆️ Pushing working branch to GitHub...");
      execSync("git push", { stdio: "inherit" });
      console.log("🎉 Deployment complete! Live site updated on GitHub Pages.");
    } catch (pushErr) {
      console.log("Notice during git push:", pushErr.message);
    }
  }
);
