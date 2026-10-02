// Derives web renditions of the supplied master logo. The artwork is never altered:
// only fully transparent margins are removed and the image is resized (Lanczos), saved as lossless PNG.
import sharp from "sharp";
// Run from apps/nusantara-website: node brand-source/derive-renditions.mjs
const SRC = "brand-source/nusantara-logo-master.webp";
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
console.log("source", info.width, "x", info.height, "artwork box", box);
const out = [];
for (const h of [66, 84]) for (const d of [1, 2, 3]) {
  const H = h * d;
  const file = `public/brand/nusantara-logo-h${h}@${d}x.png`;
  await sharp(SRC).extract(box).resize({ height: H, kernel: "lanczos3" }).png({ compressionLevel: 9, palette: false }).toFile(file);
  const m = await sharp(file).metadata();
  out.push({ file, w: m.width, h: m.height, alpha: m.hasAlpha });
}
console.log(JSON.stringify({ aspect: box.width / box.height, out }, null, 1));
