// Media storage rules, over HTTP, against a deployment with S3 configured.
//
//   CMS_TEST_EDITOR_EMAIL=… CMS_TEST_EDITOR_PASSWORD=… CMS_TEST_REVIEWER_EMAIL=… CMS_TEST_REVIEWER_PASSWORD=… \
//   CMS_TEST_ADMIN_EMAIL=… CMS_TEST_ADMIN_PASSWORD=… node scripts/regression/media-access.mjs --base https://<deployment>
//
// Uploads a small TEST image and checks: unpublished media is not served to
// anonymous visitors; only a Reviewer/Admin can approve a file for public
// use, and only with its source/licence recorded; approved files are served
// with private, no-store caching and nosniff; disallowed types and oversized
// files are refused. The TEST file is deleted at the end. Refuses to run
// against a production data environment.
import sharp from "sharp";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const B = arg("base", "http://localhost:3104");
const env = (k) => process.env[k] ?? (() => { throw new Error(`Set ${k}.`); })();
const O = { Origin: B };
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

const health = await fetch(`${B}/api/cms-health`).then((r) => r.json()).catch(() => ({}));
if (health.dataEnvironment === "production") {
  console.error("Refusing: this site reports the production data environment.");
  process.exit(2);
}
async function login(prefix) {
  const r = await fetch(`${B}/api/cms/users/login`, { method: "POST", headers: { ...O, "Content-Type": "application/json" }, body: JSON.stringify({ email: env(`${prefix}_EMAIL`), password: env(`${prefix}_PASSWORD`) }) });
  if (r.status !== 200) throw new Error(`login ${prefix}: ${r.status}`);
  return { ...O, Cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}
const ED = await login("CMS_TEST_EDITOR"), RV = await login("CMS_TEST_REVIEWER"), AD = await login("CMS_TEST_ADMIN");

async function upload(headers, bytes, filename, type, fields = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type }), filename);
  fd.append("_payload", JSON.stringify({ alt: "TEST image (media regression)", ...fields }));
  const r = await fetch(`${B}/api/cms/media`, { method: "POST", headers, body: fd });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const png = await sharp({ create: { width: 64, height: 40, channels: 3, background: "#12384a" } }).png().toBuffer();
const up = await upload(ED, png, `test-media-regression-${Date.now()}.png`, "image/png", { publicDelivery: true });
check("editor uploads an image", up.status === 201, String(up.status));
const doc = up.json.doc ?? {};
check("editor cannot approve it for public use", doc.publicDelivery === false, String(doc.publicDelivery));
// Payload returns absolute URLs on its configured origin; test the path against --base.
const fileUrl = new URL(new URL(doc.url ?? "/missing", B).pathname, B).toString();
check("file is served through the access-controlled route, not a bucket URL", new URL(fileUrl).pathname.startsWith("/api/cms/media/file/"), doc.url);

const anon1 = await fetch(fileUrl);
check("anonymous visitor cannot open an unapproved file", anon1.status === 403 || anon1.status === 404, String(anon1.status));
const anonList = await (await fetch(`${B}/api/cms/media`)).json().catch(() => ({}));
check("anonymous media listing shows no unapproved files", !(anonList.docs ?? []).some((d) => d.id === doc.id));
const staff = await fetch(fileUrl, { headers: ED });
check("signed-in staff can open it", staff.status === 200, String(staff.status));

const noCredit = await fetch(`${B}/api/cms/media/${doc.id}`, { method: "PATCH", headers: { ...RV, "Content-Type": "application/json" }, body: JSON.stringify({ publicDelivery: true }) });
check("approval without source/licence is refused", noCredit.status === 400, String(noCredit.status));
const approve = await fetch(`${B}/api/cms/media/${doc.id}`, { method: "PATCH", headers: { ...RV, "Content-Type": "application/json" }, body: JSON.stringify({ publicDelivery: true, credit: "TEST — generated test image, no licence needed" }) });
check("reviewer approves it for public use with source/licence", approve.status === 200 && (await approve.json()).doc?.publicDelivery === true);

const anon2 = await fetch(fileUrl);
check("anonymous visitor can open the approved file", anon2.status === 200 && anon2.headers.get("content-type") === "image/png", `${anon2.status} ${anon2.headers.get("content-type")}`);
check("approved file is private, no-store (no shared cache keeps it after withdrawal)", /private/.test(anon2.headers.get("cache-control") ?? "") && /no-store/.test(anon2.headers.get("cache-control") ?? ""), anon2.headers.get("cache-control"));
check("served with nosniff", anon2.headers.get("x-content-type-options") === "nosniff");

const withdraw = await fetch(`${B}/api/cms/media/${doc.id}`, { method: "PATCH", headers: { ...RV, "Content-Type": "application/json" }, body: JSON.stringify({ publicDelivery: false }) });
check("reviewer withdraws approval", withdraw.status === 200);
const anon3 = await fetch(fileUrl);
check("withdrawn file is no longer served to anonymous visitors", anon3.status === 403 || anon3.status === 404, String(anon3.status));

const svg = await upload(ED, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "test.svg", "image/svg+xml");
check("SVG upload is refused", svg.status >= 400 && svg.status < 500, String(svg.status));
const html = await upload(ED, Buffer.from("<html><script>alert(1)</script></html>"), "test.html", "text/html");
check("HTML upload is refused", html.status >= 400 && html.status < 500, String(html.status));

const del = await fetch(`${B}/api/cms/media/${doc.id}`, { method: "DELETE", headers: AD });
check("admin deletes the TEST file", del.status === 200, String(del.status));
const gone = await fetch(fileUrl, { headers: AD });
// S3 answers 404; Payload's local-disk handler (development only) answers 500 for a missing file.
check("deleted file is no longer served, even to staff", gone.status !== 200 && !(gone.headers.get("content-type") ?? "").startsWith("image/"), String(gone.status));
// Last: the server refuses an oversized body before reading it, which closes that connection.
// (Skipped under Netlify's local `netlify serve`, whose function emulator cannot take such a body;
// on Netlify itself the platform refuses function bodies over its ~6 MB limit, and browser uploads
// go straight to S3 under a signed 10 MB limit.)
if (process.env.NETLIFY_LOCAL_PROXY !== "1") {
  const big = await upload(ED, Buffer.alloc(10_500_000, 1), "test-big.png", "image/png");
  check("file over 10 MB is refused", big.status >= 400 && big.status < 500, String(big.status));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
