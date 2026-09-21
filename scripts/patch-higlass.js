const fs = require("fs");
const path = require("path");

const hglibPath = path.join(__dirname, "..", "node_modules", "higlass", "dist", "hglib.js");

if (fs.existsSync(hglibPath)) {
  let content = fs.readFileSync(hglibPath, "utf8");
  const target = `_this38.tilesetInfo = null;\n          _this38.setError(_this38.tilesetInfo.error);`;
  const replacement = `var _tilesetError = _this38.tilesetInfo.error;\n          _this38.tilesetInfo = null;\n          _this38.setError(_tilesetError);`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(hglibPath, content, "utf8");
    console.log("[patch-higlass] Successfully patched hglib.js tilesetInfo error handling!");
  } else if (content.includes(replacement)) {
    console.log("[patch-higlass] hglib.js is already patched.");
  } else {
    const regex = /_this38\.tilesetInfo\s*=\s*null;\s*_this38\.setError\(_this38\.tilesetInfo\.error\);/;
    if (regex.test(content)) {
      content = content.replace(
        regex,
        "var _tilesetError = _this38.tilesetInfo.error;\n          _this38.tilesetInfo = null;\n          _this38.setError(_tilesetError);"
      );
      fs.writeFileSync(hglibPath, content, "utf8");
      console.log("[patch-higlass] Successfully patched hglib.js via regex!");
    } else {
      console.warn("[patch-higlass] Target pattern not found in hglib.js.");
    }
  }
} else {
  console.warn("[patch-higlass] hglib.js not found at " + hglibPath);
}
