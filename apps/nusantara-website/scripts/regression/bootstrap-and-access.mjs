// Account-creation security and first-Admin bootstrap, over HTTP.
//
//   node scripts/regression/bootstrap-and-access.mjs --base https://<deployment>
//
// Always (safe on any deployment): anonymous account creation is refused —
// through the REST API and Payload's first-register endpoint — and the
// bootstrap endpoint refuses cross-site posts and wrong tokens.
//
// Bootstrap (only when the database has no accounts and these are set):
//   CMS_BOOTSTRAP_TOKEN, CMS_FIRST_ADMIN_EMAIL, CMS_FIRST_ADMIN_NAME, CMS_FIRST_ADMIN_PASSWORD
// creates the first Admin through the bootstrap window, signs in to verify it,
// and checks the window is then closed for good.
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const B = arg("base", "http://localhost:3104");
const J = { "Content-Type": "application/json", Origin: B };
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };
const cookiesOf = (r) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const form = (token, extra = {}) =>
  fetch(`${B}/api/cms-bootstrap`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", "Sec-Fetch-Site": "same-origin", ...extra }, body: new URLSearchParams({ token }) });
const someone = { email: `anon-${Date.now()}@example.invalid`, name: "Anonymous", password: "anonymous-password-123" };

const init = await (await fetch(`${B}/api/cms/users/init`)).json().catch(() => ({}));
console.log(`      accounts exist: ${init.initialized}`);

// 1. Anonymous account creation. (Netlify's local `netlify serve` proxy turns a 403 into a 404
// while it probes static fallbacks; the deployed platform returns the function's 403.)
const refused = (st) => st === 403 || (st === 404 && process.env.NETLIFY_LOCAL_PROXY === "1");
const r1 = await fetch(`${B}/api/cms/users`, { method: "POST", headers: J, body: JSON.stringify(someone) });
check("anonymous POST /api/cms/users is refused", refused(r1.status), String(r1.status));
const r2 = await fetch(`${B}/api/cms/users/first-register`, { method: "POST", headers: J, body: JSON.stringify(someone) });
check("anonymous first-register without the bootstrap cookie is refused", refused(r2.status), String(r2.status));
const forged = await fetch(`${B}/api/cms/users/first-register`, { method: "POST", headers: { ...J, Cookie: "nusantara-bootstrap=forged" }, body: JSON.stringify(someone) });
check("first-register with a forged bootstrap cookie is refused", refused(forged.status), String(forged.status));
const asSomeone = await fetch(`${B}/api/cms/users/login`, { method: "POST", headers: J, body: JSON.stringify({ email: someone.email, password: someone.password }) });
check("no account was created by any anonymous attempt", asSomeone.status === 401, String(asSomeone.status));

// 2. Bootstrap endpoint.
const xs = await form("x".repeat(64), { "Sec-Fetch-Site": "cross-site", Origin: "https://evil.example" });
check("cross-site bootstrap post is refused", refused(xs.status), String(xs.status));
const wrong = await form("0".repeat(64));
check("wrong bootstrap token sets no cookie", wrong.status === 303 && !wrong.headers.get("set-cookie") && /state=(invalid|closed)/.test(wrong.headers.get("location") ?? ""), `${wrong.status} → ${wrong.headers.get("location")}`);
const page = await fetch(`${B}/admin/bootstrap`);
check("/admin/bootstrap is not indexable or cacheable", /noindex/.test(page.headers.get("x-robots-tag") ?? "") && /no-store/.test(page.headers.get("cache-control") ?? ""));

// 3. Bootstrap the first Admin (optional).
const { CMS_BOOTSTRAP_TOKEN: token, CMS_FIRST_ADMIN_EMAIL: email, CMS_FIRST_ADMIN_NAME: name, CMS_FIRST_ADMIN_PASSWORD: password } = process.env;
if (token && email && password && !init.initialized) {
  const ok = await form(token);
  const cookie = cookiesOf(ok);
  check("valid token → short-lived HttpOnly cookie, redirect to create-first-user", ok.status === 303 && ok.headers.get("location") === "/admin/create-first-user" && /HttpOnly/i.test(ok.headers.get("set-cookie") ?? "") && /Max-Age=900/.test(ok.headers.get("set-cookie") ?? ""));
  check("cookie does not contain the token", !cookie.includes(token));
  const reg = await fetch(`${B}/api/cms/users/first-register`, { method: "POST", headers: { ...J, Cookie: cookie }, body: JSON.stringify({ email, name: name ?? "Nusantara Admin", password, role: "editor" }) });
  const regJson = await reg.json().catch(() => ({}));
  check("first Admin created through the bootstrap window", reg.status === 200, `${reg.status} ${reg.status === 200 ? "" : JSON.stringify(regJson).slice(0, 200)}`);
  const login = await fetch(`${B}/api/cms/users/login`, { method: "POST", headers: J, body: JSON.stringify({ email, password }) });
  const session = cookiesOf(login);
  const me = await (await fetch(`${B}/api/cms/users/me`, { headers: { Cookie: session, Origin: B } })).json();
  check("verify: the new account signs in and is an Admin (role cannot be chosen)", login.status === 200 && me.user?.role === "admin", me.user?.role);
  const noOrigin = await (await fetch(`${B}/api/cms/users/me`, { headers: { Cookie: session } })).json();
  check("session cookie is ignored without a same-site Origin (CSRF)", noOrigin.user === null);
  const evil = await (await fetch(`${B}/api/cms/users/me`, { headers: { Cookie: session, Origin: "https://evil.example" } })).json();
  check("session cookie is ignored from a foreign Origin (CSRF)", evil.user === null);
  const replay = await fetch(`${B}/api/cms/users/first-register`, { method: "POST", headers: { ...J, Cookie: cookie }, body: JSON.stringify(someone) });
  check("bootstrap cookie cannot create a second account", refused(replay.status), String(replay.status));
  const again = await form(token);
  check("bootstrap window is closed once an account exists", again.status === 303 && !again.headers.get("set-cookie") && /state=closed/.test(again.headers.get("location") ?? ""));
  const closedPage = await (await fetch(`${B}/admin/bootstrap`)).text();
  check("/admin/bootstrap says set-up is closed", closedPage.includes("Set-up is closed"));
} else {
  console.log("      (bootstrap step skipped: accounts exist or bootstrap variables not set)");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
