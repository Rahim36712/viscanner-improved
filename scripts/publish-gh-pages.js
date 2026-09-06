const ghpages = require("gh-pages");
const path = require("path");
const { execSync } = require("child_process");

const dist = path.join(__dirname, "../dist");

function getRemoteUrl(remote) {
  try {
    return execSync(`git remote get-url --push ${remote}`, { encoding: "utf8" }).trim().split(/\r?\n/)[0];
  } catch {
    try {
      return execSync(`git remote get-url ${remote}`, { encoding: "utf8" }).trim().split(/\r?\n/)[0];
    } catch {
      return null;
    }
  }
}

function publishToRemote(remote) {
  return new Promise((resolve) => {
    const repoUrl = getRemoteUrl(remote);
    console.log(`🌐 Publishing dist/ to ${remote}/gh-pages (${repoUrl || remote})...`);
    ghpages.publish(
      dist,
      {
        branch: "gh-pages",
        repo: repoUrl || undefined,
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
