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

console.log("Local gh-pages branch updated. (No automatic push to remotes performed).");
