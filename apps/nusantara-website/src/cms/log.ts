/**
 * Operational events for the Admin Portal: one JSON line per event on
 * stdout/stderr, which Netlify keeps in its function and build logs.
 *
 *   {"ts":"…","level":"error","event":"cms.revalidate.failed","collection":"insights",…}
 *
 * Never logged: passwords, session or bootstrap tokens, secrets, cookies,
 * request bodies or content. Database errors are logged without their query
 * parameters, which can contain unpublished content.
 */
type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /pass(word)?|token|secret|cookie|authorization|session|salt|hash|body|content|data|params/i;

/** Removes the "params: …" tail Drizzle appends to failed-query messages, and caps length. */
export function scrubText(s: string, max = 600): string {
  return s.replace(/\n?params:[\s\S]*?(?=\ncaused by:|$)/g, "\n[params removed]").slice(0, max);
}

function scrub(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return scrubText(v);
  if (v instanceof Error) return { name: v.name, message: scrubText(v.message), code: (v as { code?: unknown }).code };
  if (!v || typeof v !== "object" || depth > 3) return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => scrub(x, depth + 1));
  const out: Fields = {};
  for (const [k, x] of Object.entries(v)) out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : scrub(x, depth + 1);
  return out;
}

export function logEvent(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(scrub(fields) as Fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Database connectivity failures, recognisable by driver error codes. */
export const isDbConnectionError = (err: unknown) => {
  const code = String((err as { code?: unknown; cause?: { code?: unknown } })?.code ?? (err as { cause?: { code?: unknown } })?.cause?.code ?? "");
  return /^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|57P01|57P03|08\d{3}|53300)$/.test(code) || /Connection terminated|timeout exceeded when trying to connect/i.test(String((err as Error)?.message ?? ""));
};

/**
 * Pino options for Payload's own logger: the same scrubbing for the error
 * objects Payload logs (its database errors include query parameters).
 */
export const payloadLoggerOptions = {
  formatters: {
    log(obj: Fields) {
      const out: Fields = { ...obj };
      if (typeof out.msg === "string") out.msg = scrubText(out.msg, 2000);
      const scrubErr = (e: unknown): unknown => {
        if (!e || typeof e !== "object") return e;
        // Drizzle attaches the query's bound values as err.params; they never reach the log.
        const { params: _params, ...rest } = e as Fields; // eslint-disable-line @typescript-eslint/no-unused-vars
        for (const k of ["message", "stack"]) if (typeof rest[k] === "string") rest[k] = scrubText(rest[k] as string, 4000);
        if (rest.cause) rest.cause = scrubErr(rest.cause);
        return rest;
      };
      if (out.err) out.err = scrubErr(out.err);
      return out;
    },
  },
};
