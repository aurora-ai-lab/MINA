import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataFile = path.join(root, "data", "works.json");
const works = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const outDir = path.join(root, "images", "thumbs");
const ogDir = path.join(root, "images", "og");
fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(ogDir, { recursive: true });
const clean = (p) => String(p).split("?")[0];
const generated = [];
for (const w of works) {
  const source = path.join(root, clean(w.image));
  if (!fs.existsSync(source) || w.mediaType === "video") continue;
  const ext = path.extname(source).toLowerCase();
  const category = w.category === "women" ? "portrait" : w.category === "web_ui" ? "web-ui" : w.category;
  const target = path.join(outDir, category, `${w.id}.webp`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const result = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-c:v", "libwebp", "-q:v", "78", target], { cwd: root });
  if (result.status !== 0) { console.error(`thumbnail failed: ${w.id}`, result.stderr?.toString()); continue; }
  const og = path.join(ogDir, `${w.id}.webp`);
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-vf", "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630", "-c:v", "libwebp", "-q:v", "80", og], { cwd: root });
  w.thumb = `images/thumbs/${category}/${w.id}.webp`;
  w.og = `images/og/${w.id}.webp`;
  generated.push(w.id);
}
if (generated.length) {
  fs.writeFileSync(dataFile, `${JSON.stringify(works, null, 2)}\n`);
  const first = generated[0];
  fs.copyFileSync(path.join(ogDir, `${first}.webp`), path.join(ogDir, "coolcat-og.webp"));
}
console.log(`Generated ${generated.length} thumbnails and OG images.`);
