// Publish → on-demand revalidation regression, against a CMS-source site
// (CONTENT_SOURCE=cms) on a LOCAL or deliberately disposable test database.
//
//   CMS_TEST_REVIEWER_EMAIL=… CMS_TEST_REVIEWER_PASSWORD=… \
//   CMS_TEST_ADMIN_EMAIL=… CMS_TEST_ADMIN_PASSWORD=… \
//   node scripts/regression/publish-revalidation.mjs --base http://localhost:3103
//
// A Reviewer publishes a temporary TEST Insight; every public route (sitemap,
// legal pages included) must stay 200 and show the change with no rebuild;
// unknown legal slugs must stay a complete, styled 404. The Insight is then
// archived (withdrawn) and deleted by an Admin. Refuses to run against a
// database whose health check reports the production data environment.
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const B = arg("base", "http://localhost:3103");
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Set ${k}.`);
  return v;
};
const H = { "Content-Type": "application/json", Origin: B };
const SLUG = "test-regression-publish-revalidation";
const TITLE = "TEST — publish/revalidation regression (temporary)";
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

const health = await fetch(`${B}/api/cms-health`).then((r) => r.json()).catch(() => ({}));
if (health.dataEnvironment === "production") {
  console.error("Refusing: this site reports the production data environment.");
  process.exit(2);
}

async function login(email, password) {
  const r = await fetch(`${B}/api/cms/users/login`, { method: "POST", headers: H, body: JSON.stringify({ email, password }) });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return { ...H, Cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}
const RV = await login(env("CMS_TEST_REVIEWER_EMAIL"), env("CMS_TEST_REVIEWER_PASSWORD"));
const AD = await login(env("CMS_TEST_ADMIN_EMAIL"), env("CMS_TEST_ADMIN_PASSWORD"));

const sitemap = await (await fetch(`${B}/sitemap.xml`)).text();
const routes = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)), "/api/insights/search-index"];
check("sitemap includes the legal pages", routes.some((p) => p.startsWith("/legal/")));

async function crawl(label) {
  const bad = [];
  for (const p of routes) {
    const s = (await fetch(B + p)).status;
    if (s !== 200) bad.push(`${p} ${s}`);
  }
  check(`${label}: all ${routes.length} public routes return 200`, bad.length === 0, bad.join(", "));
}
async function unknownLegal(label) {
  for (const p of ["/legal/not-a-page", "/legal/PRIVACY"]) {
    const r = await fetch(B + p);
    const html = await r.text();
    const ok =
      r.status === 404 &&
      !html.includes('id="__next_error__"') &&
      /<title>Page not found \| [^<]+<\/title>/.test(html) &&
      html.includes("This page could not be found.") &&
      html.includes("Return home") &&
      html.includes('rel="stylesheet"');
    check(`${label}: ${p} is a complete styled 404 without JavaScript`, ok, String(r.status));
  }
}

// The site layout embeds its render time (renderedAt); a changed value proves the page was re-rendered.
const legalRoutes = routes.filter((r) => r.startsWith("/legal/"));
const renderedAt = async (p) => (await (await fetch(B + p)).text()).match(/renderedAt\\?":(\d+)/)?.[1];
const before = Object.fromEntries(await Promise.all(legalRoutes.map(async (p) => [p, await renderedAt(p)])));

await crawl("before");
await unknownLegal("before");

const old = await (await fetch(`${B}/api/cms/insights?where[slug][equals]=${SLUG}&draft=true&depth=0`, { headers: AD })).json();
for (const d of old.docs ?? []) await fetch(`${B}/api/cms/insights/${d.id}`, { method: "DELETE", headers: AD });

const created = await fetch(`${B}/api/cms/insights?draft=true`, {
  method: "POST",
  headers: RV,
  body: JSON.stringify({
    slug: SLUG,
    title: TITLE,
    subtitle: "Temporary regression article. Not Nusantara research.",
    category: "Research Notes",
    date: new Date().toISOString(),
    summary: "TEST summary for the publish/revalidation regression.",
    author: "Nusantara Research",
    body: [{ blockType: "paragraph", text: "TEST paragraph." }],
    workflowStatus: "draft",
  }),
});
const cj = await created.json();
check("reviewer creates a draft TEST Insight", created.status === 201, `${created.status} ${created.status === 201 ? "" : JSON.stringify(cj).slice(0, 300)}`);
const id = cj.doc?.id;
check("draft is not public", (await fetch(`${B}/insights/${SLUG}`)).status === 404);

const t0 = Date.now();
const pub = await fetch(`${B}/api/cms/insights/${id}`, { method: "PATCH", headers: RV, body: JSON.stringify({ workflowStatus: "published", _status: "published" }) });
check("reviewer publishes it", pub.status === 200, String(pub.status));
check("article live immediately", (await fetch(`${B}/insights/${SLUG}`)).status === 200);
check("listed on /insights immediately", (await (await fetch(`${B}/insights`)).text()).includes(TITLE));
console.log(`      (publish → visible in ${Date.now() - t0} ms, no rebuild)`);
await crawl("after publish");
await unknownLegal("after publish");
for (const p of legalRoutes) {
  await fetch(B + p); // a revalidated ISR page may serve once more while it regenerates
  const now = await renderedAt(p);
  check(`${p} regenerated after publishing`, !!now && !!before[p] && now !== before[p], `${before[p]} → ${now}`);
}

const arch = await fetch(`${B}/api/cms/insights/${id}`, { method: "PATCH", headers: RV, body: JSON.stringify({ workflowStatus: "archived", _status: "published" }) });
check("reviewer archives it", arch.status === 200, String(arch.status));
check("article withdrawn immediately", (await fetch(`${B}/insights/${SLUG}`)).status === 404);
await crawl("after archive");
await unknownLegal("after archive");
const del = await fetch(`${B}/api/cms/insights/${id}`, { method: "DELETE", headers: AD });
check("admin deletes the TEST Insight", del.status === 200, String(del.status));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
