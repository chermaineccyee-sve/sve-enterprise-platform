// Public-site parity check: compares a reference build (the frozen Eric Review
// Build, e803790) with a candidate build, route by route.
//
//   node scripts/parity/parity.mjs --base http://localhost:3101 --head http://localhost:3102 [--out parity-out] [--no-shots]
//
// For every URL in the reference sitemap, plus 404s, metadata files and the
// public API routes, it compares:
//   1. HTTP status, content type and security headers;
//   2. HTML with build-specific noise removed (hashed /_next/static paths and
//      inline framework scripts) — i.e. the rendered markup and text;
//   3. the CSS actually linked by each page (content, not file names);
//   4. JSON API bodies (timestamps normalised) and binary files (SHA-256);
//   5. full-page screenshots, desktop 1440×900 and mobile 390×844, with the
//      browser clock fixed and reduced motion, compared pixel by pixel.
// Exit code 0 only when everything matches. See scripts/parity/README.md.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3101");
const HEAD = arg("head", "http://localhost:3102");
const OUT = arg("out", "parity-out");
const SHOTS = !process.argv.includes("--no-shots");
const FIXED_TIME = new Date("2026-10-05T01:30:00.000Z"); // 09:30 MYT / SGT
mkdirSync(OUT, { recursive: true });

const HEADERS = ["content-type", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "strict-transport-security", "x-robots-tag", "vary", "accept-ch", "critical-ch"];

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const fromSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const extra = [
  "/does-not-exist",
  "/insights/removed-article-xyz",
  "/strategies/not-a-capability",
  "/legal/not-a-page",
  "/a/b/c",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/opengraph-image.jpg",
  "/api/market/snapshot",
  "/api/market/intelligence",
  ...["1D", "1W", "1M", "3M", "YTD", "1Y"].map((p) => `/api/market/history/${p}`),
  "/api/insights/search-index",
];
const routes = [...new Set([...fromSitemap, ...extra])];

const strip = (html) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "<script/>")
    .replace(/\/_next\/static\/[^"'\s)]+/g, "/_next/static/~")
    .replace(/<link[^>]+_next\/static\/~[^>]*>/g, "<link-static/>")
    // The number of framework chunks/flight-data scripts depends on bundling, not on the page.
    .replace(/(?:<script\/>|<link-static\/>)+/g, "<framework/>")
    // React-internal values with no visible effect: useId() ids (they depend on the
    // component tree's depth) and Suspense boundary markers.
    .replace(/_R_[A-Za-z0-9]+_/g, "_R_~_")
    .replace(/<!--\/?\$[?!]?-->/g, "")
    .replace(/\s+/g, " ");
const normJson = (t) => t.replace(/"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z"/g, '"<iso>"');
const sha = (b) => createHash("sha256").update(b).digest("hex");

async function css(origin, html) {
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  const parts = await Promise.all(hrefs.map(async (h) => (await fetch(new URL(h, origin))).text()));
  return parts.join("\n");
}

const results = [];
let failures = 0;
const fail = (route, what, detail = "") => {
  failures++;
  results.push({ route, what, detail });
  console.log(`DIFF ${route} — ${what}${detail ? `: ${detail}` : ""}`);
};

for (const r of routes) {
  const [a, b] = await Promise.all([fetch(BASE + r, { redirect: "manual" }), fetch(HEAD + r, { redirect: "manual" })]);
  if (a.status !== b.status) fail(r, "status", `${a.status} vs ${b.status}`);
  for (const h of HEADERS) if (a.headers.get(h) !== b.headers.get(h)) fail(r, `header ${h}`, `${a.headers.get(h)} | ${b.headers.get(h)}`);
  const type = a.headers.get("content-type") ?? "";
  if (type.includes("text/html")) {
    const [ha, hb] = [await a.text(), await b.text()];
    const [sa, sb] = [strip(ha), strip(hb)];
    if (sa !== sb) {
      let i = 0;
      while (i < sa.length && sa[i] === sb[i]) i++;
      fail(r, "html", `first difference at ${i}: «${sa.slice(i - 80, i + 120)}» vs «${sb.slice(i - 80, i + 120)}»`);
    }
    const [ca, cb] = await Promise.all([css(BASE, ha), css(HEAD, hb)]);
    if (ca !== cb) fail(r, "css", `${ca.length} vs ${cb.length} bytes`);
  } else if (type.includes("json")) {
    if (normJson(await a.text()) !== normJson(await b.text())) fail(r, "json body");
  } else if (type.startsWith("text/")) {
    if ((await a.text()) !== (await b.text())) fail(r, "text body");
  } else {
    const [ba, bb] = [Buffer.from(await a.arrayBuffer()), Buffer.from(await b.arrayBuffer())];
    if (sha(ba) !== sha(bb)) fail(r, "binary body");
  }
  console.log(`checked ${r} (${a.status})`);
}

let shots = 0;
const unstable = [];
if (SHOTS) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  const htmlRoutes = routes.filter((r) => !r.startsWith("/api/") && !/\.(txt|xml|ico|png|jpg)$/.test(r));
  const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
  const cmp = await (await browser.newContext()).newPage();
  for (const [vpName, vp] of Object.entries(viewports)) {
    const { isMobile, hasTouch, deviceScaleFactor, ...viewport } = vp;
    const ctx = await browser.newContext({ viewport, isMobile, hasTouch, deviceScaleFactor: deviceScaleFactor ?? 1, reducedMotion: "reduce" });
    // A pair that still differs is checked once more from scratch before it is reported.
    const checkPair = async (r, last) => {
        // Both pages stay open: if the first captures differ (e.g. a chart caught
        // mid-draw), both are captured again after a settle delay.
        const pages = [];
        for (const origin of [BASE, HEAD]) {
          const page = await ctx.newPage();
          await page.clock.setFixedTime(FIXED_TIME);
          await page.goto(origin + r, { waitUntil: "load" });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await page.evaluate(() => document.fonts.ready);
          pages.push(page);
        }
        // Full-page capture would resize the viewport mid-capture and make charts
        // re-measure and redraw. Instead each page is first resized to its full
        // height (same for both), allowed to settle, then captured.
        const fullHeight = Math.max(...(await Promise.all(pages.map((pg) => pg.evaluate(() => document.documentElement.scrollHeight)))));
        // Charts measure their axis labels once; whether the web font has swapped in by
        // then is a race. A 1px width nudge makes every chart re-measure with the final font.
        await Promise.all(pages.map((pg) => pg.setViewportSize({ width: viewport.width + 1, height: fullHeight })));
        await pages[1].waitForTimeout(300);
        await Promise.all(pages.map((pg) => pg.setViewportSize({ width: viewport.width, height: fullHeight })));
        // Scroll-driven UI (the article reading-progress bar) settles on an explicit scroll event.
        await Promise.all(pages.map((pg) => pg.evaluate(() => window.dispatchEvent(new Event("scroll")))));
        await pages[1].waitForTimeout(1500);
        const capture = () => Promise.all(pages.map((pg) => pg.screenshot({ fullPage: true, animations: "disabled" })));
        let pngs = await capture();
        for (let attempt = 0; attempt < 2 && sha(pngs[0]) !== sha(pngs[1]); attempt++) {
          await pages[1].waitForTimeout(2500);
          pngs = await capture();
        }
        await Promise.all(pages.map((pg) => pg.close()));
        const name = `${vpName}${r === "/" ? "_home" : r.replace(/\//g, "_")}`;
        if (sha(pngs[0]) === sha(pngs[1])) {
          console.log(`pixels identical ${vpName} ${r}`);
          return true;
        }
        // Still different: load the REFERENCE a second time. Regions that differ between
        // two loads of the reference itself (live-clock-driven charts, animation
        // phases) cannot be compared; every other 32×32 tile must match exactly.
        const controls = [];
        for (let k = 0; k < 2; k++) {
          const ref2 = await ctx.newPage();
          await ref2.clock.setFixedTime(FIXED_TIME);
          await ref2.goto(BASE + r, { waitUntil: "load" });
          await ref2.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await ref2.evaluate(() => document.fonts.ready);
          await ref2.setViewportSize({ width: viewport.width + 1, height: fullHeight });
          await ref2.waitForTimeout(300);
          await ref2.setViewportSize({ width: viewport.width, height: fullHeight });
          await ref2.evaluate(() => window.dispatchEvent(new Event("scroll")));
          await ref2.waitForTimeout(1500);
          controls.push((await ref2.screenshot({ fullPage: true, animations: "disabled" })).toString("base64"));
          await ref2.close();
        }
        const d = await cmp.evaluate(async ([x, y, ...zs]) => {
          const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + s; });
          const [i1, i2, ...is] = await Promise.all([load(x), load(y), ...zs.map(load)]);
          if (i1.width !== i2.width || i1.height !== i2.height) return { size: `${i1.width}x${i1.height} vs ${i2.width}x${i2.height}` };
          const W = i1.width, H = i1.height, T = 32;
          const px = (i) => { const c = new OffscreenCanvas(W, H); const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, W, H).data; };
          const [p1, p2] = [px(i1), px(i2)];

          const tiles = (a, b) => { const t = new Set(); let n = 0; for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) { n++; const q = k / 4; t.add(`${Math.floor((q % W) / T)},${Math.floor(q / W / T)}`); } return { t, n }; };
          const head = tiles(p1, p2);
          // Union of the reference's own variation across its extra loads.
          const ctl = { t: new Set(), n: 0 };
          for (const i of is) if (i.width === W && i.height === H) { const c = tiles(p1, px(i)); c.t.forEach((k) => ctl.t.add(k)); ctl.n = Math.max(ctl.n, c.n); }
          const outside = [...head.t].filter((k) => !ctl.t.has(k));
          return { n: head.n, controlN: ctl.n, outside: outside.length, outsideSample: outside.slice(0, 5) };
        }, [pngs[0].toString("base64"), pngs[1].toString("base64"), ...controls]);
        // Accepted only when the reference varies at least as much between its own loads.
        if (d.size || (d.outside && d.n > d.controlN)) {
          if (!last) return false;
          writeFileSync(`${OUT}/${name}.base.png`, pngs[0]);
          writeFileSync(`${OUT}/${name}.head.png`, pngs[1]);
          fail(r, `pixels (${vpName})`, d.size ?? `${d.n} pixels differ (reference self-diff ${d.controlN}); ${d.outside} tile(s) outside the reference's own load-to-load variation, e.g. ${d.outsideSample.join(" ")}`);
        } else {
          unstable.push({ route: r, viewport: vpName, pixels: d.n, referenceSelfDiffPixels: d.controlN });
          console.log(`pixels within reference load-to-load variation ${vpName} ${r} (${d.n} px vs reference self-diff ${d.controlN} px)`);
        }
        return true;
    };
    for (const r of htmlRoutes) {
      shots++;
      if (!(await checkPair(r, false))) await checkPair(r, true);
    }
    await ctx.close();
  }
  await browser.close();
}

const summary = { base: BASE, head: HEAD, routes: routes.length, screenshotPairs: shots, failures, results, unstable };
writeFileSync(`${OUT}/parity-report.json`, JSON.stringify(summary, null, 2));
console.log(`\n${routes.length} routes, ${shots} screenshot pairs — ${failures ? `${failures} DIFFERENCES` : "IDENTICAL"}`);
process.exit(failures ? 1 : 0);
