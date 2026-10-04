/**
 * CMS ⇄ local equivalence: loads the content the website would render from
 * the Admin Portal (CONTENT_SOURCE=cms, live versions) and compares it, record
 * by record and field by field, with the typed files in src/content.
 *
 *   npm run cms:verify-equivalence
 *
 * Normalisation is limited to representation, not content: absent optional
 * fields equal empty lists / false (the site treats them identically), and
 * key order is ignored. Everything else — every id, word, relationship,
 * date, status and sample flag — must match exactly.
 */
import { loadCmsContent } from "../../lib/content/cms-source";
import { LOCAL_CONTENT, type RawContent } from "../../lib/content/source";

type Rec = Record<string, unknown>;
const OPTIONAL_LISTS = new Set(["related", "markets", "themes", "assetClasses", "capabilities", "marketStateDimensions"]);

function normalise(v: unknown, key = ""): unknown {
  if (Array.isArray(v)) return v.map((x) => normalise(x));
  if (v && typeof v === "object") {
    const out: Rec = {};
    for (const k of Object.keys(v as Rec).sort()) {
      const x = (v as Rec)[k];
      if (x === undefined) continue;
      if (OPTIONAL_LISTS.has(k) && Array.isArray(x) && x.length === 0) continue;
      if (k === "featured" && x === false) continue;
      if (k === "ordered" && x === false) continue;
      out[k] = normalise(x, k);
    }
    return out;
  }
  return key ? v : v;
}

const cms = await loadCmsContent(null, { cached: false });
const kinds: (keyof Omit<RawContent, "preview">)[] = ["insights", "views", "marketStateEditions", "signals", "themes", "capabilities"];
const keyOf = (r: Rec) => String(r.slug ?? r.id);
let diffs = 0;
let compared = 0;

function diffPath(a: unknown, b: unknown, path: string, out: string[]) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) === !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a as Rec), ...Object.keys(b as Rec)])) diffPath((a as Rec)[k], (b as Rec)[k], `${path}.${k}`, out);
    return;
  }
  out.push(`${path}: local=${JSON.stringify(a)?.slice(0, 120)} cms=${JSON.stringify(b)?.slice(0, 120)}`);
}

for (const kind of kinds) {
  const local = LOCAL_CONTENT[kind] as unknown as Rec[];
  const fromCms = cms[kind] as unknown as Rec[];
  const orderLocal = local.map(keyOf).join(",");
  const orderCms = fromCms.map(keyOf).join(",");
  const out: string[] = [];
  if (orderLocal !== orderCms) out.push(`order/membership differs:\n    local ${orderLocal}\n    cms   ${orderCms}`);
  for (const l of local) {
    const c = fromCms.find((x) => keyOf(x) === keyOf(l));
    compared++;
    if (!c) {
      out.push(`${keyOf(l)}: missing in CMS`);
      continue;
    }
    diffPath(normalise(l), normalise(c), keyOf(l), out);
  }
  diffs += out.length;
  console.log(`${out.length ? "DIFF" : "SAME"}  ${kind}: ${local.length} local / ${fromCms.length} CMS`);
  for (const line of out.slice(0, 15)) console.log(`      ${line}`);
}
console.log(`\n${compared} records compared — ${diffs ? `${diffs} DIFFERENCES` : "IDENTICAL"}`);
process.exit(diffs ? 1 : 0);
