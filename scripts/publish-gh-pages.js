const ghpages = require("gh-pages");
const path = require("path");
const { execSync } = require("child_process");

const dist = path.join(__dirname, "../dist");

function publishToRemote(remote) {
  return new Promise((resolve) => {
    console.log(`🌐 Publishing dist/ to ${remote}/gh-pages...`);
    ghpages.publish(
      dist,
      {
        branch: "gh-pages",
        remote: remote,
        dotfiles: true,
        message: "Deploy latest production build to gh-pages [auto]",
      },
      (err) => {
        if (err) {
          console.warn(`⚠️ Warning: ghpages publish to ${remote} failed:`, err.message);
        } else {
          console.log(`✅ Successfully published dist/ to ${remote}/gh-pages!`);
        }
        resolve();
      }
    );
  });
}

async function main() {
  const remotes = execSync("git remote", { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  for (const remote of remotes) {
    await publishToRemote(remote);
  }
}

main();
