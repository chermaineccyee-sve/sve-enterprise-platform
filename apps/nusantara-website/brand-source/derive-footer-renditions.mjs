// Derives the footer (dark-ground) renditions of the supplied master logo.
// The master file is only read. The emblem, the gold full stop and every
// pixel's alpha (shape and anti-aliasing) are kept exactly; the only change is
// that the near-black, colourless wordmark pixels are given a light fill so the
// wordmark reads on the dark teal footer. Same trim and Lanczos resize as the
// header renditions (derive-renditions.mjs); saved as lossless PNG with alpha.
import sharp from "sharp";
// Run from apps/nusantara-website: node brand-source/derive-footer-renditions.mjs
const SRC = "brand-source/nusantara-logo-master.webp";
const LIGHT = [0xf7, 0xf3, 0xea]; // --color-ivory (#f7f3ea) in src/app/globals.css
const HEIGHT = 116; // ≈129px wide at the master's aspect ratio

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const isWordmarkInk = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2], max = Math.max(r, g, b);
  return max - Math.min(r, g, b) < 40 && max < 140; // colourless and dark; the gold never matches
};
// The wordmark band starts a few rows above its first solid ink row; nothing above it (the emblem) is touched.
let inkTop = H;
for (let y = 0; y < H && inkTop === H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  if (data[i + 3] >= 128 && isWordmarkInk(i)) { inkTop = y; break; }
}
const bandTop = inkTop - 5;
// Only visible ink (alpha >= 16) is recoloured. Fainter pixels (under 6% opacity) keep their
// original colour, so the near-invisible fringe around the gold full stop and the emblem's
// lowest tip is never touched.
let x0 = W, y0 = H, x1 = 0, y1 = 0, recoloured = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  if (data[i + 3] === 0) continue;
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  if (y >= bandTop && data[i + 3] >= 16 && isWordmarkInk(i)) { data[i] = LIGHT[0]; data[i + 1] = LIGHT[1]; data[i + 2] = LIGHT[2]; recoloured++; }
}
const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
console.log("source", W, "x", H, "artwork box", box, "wordmark band from row", bandTop, "wordmark pixels lightened", recoloured);
const out = [];
for (const d of [1, 2, 3]) {
  const file = `public/brand/nusantara-logo-footer-h${HEIGHT}@${d}x.png`;
  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract(box).resize({ height: HEIGHT * d, kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: false }).toFile(file);
  const m = await sharp(file).metadata();
  out.push({ file, w: m.width, h: m.height, alpha: m.hasAlpha });
}
console.log(JSON.stringify({ aspect: box.width / box.height, out }, null, 1));
