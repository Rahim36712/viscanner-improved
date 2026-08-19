const { execSync } = require("child_process");

console.log("Creating tree from dist/ folder...");
const tree = execSync("git write-tree --prefix=dist", { encoding: "utf8" }).trim();
console.log("Tree ID:", tree);

const commit = execSync(`git commit-tree ${tree} -m "Deploy latest production build to gh-pages [auto]"`, {
  encoding: "utf8",
}).trim();
console.log("Commit ID:", commit);

execSync(`git update-ref refs/heads/gh-pages ${commit}`);
console.log("Updated local gh-pages branch to", commit);

console.log("Pushing to origin gh-pages...");
try {
  execSync("git push origin gh-pages --force", { stdio: "inherit" });
  console.log("Successfully pushed to origin gh-pages!");
} catch (e) {
  console.error("Error pushing to origin gh-pages:", e.message);
}

console.log("Pushing to improved gh-pages...");
try {
  execSync("git push improved gh-pages --force", { stdio: "inherit" });
  console.log("Successfully pushed to improved gh-pages!");
} catch (e) {
  console.error("Error pushing to improved gh-pages:", e.message);
}

console.log("Done publishing gh-pages!");
