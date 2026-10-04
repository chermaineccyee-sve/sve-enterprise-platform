import type { CSSProperties } from "react";

/**
 * Shown only in an authorised Admin Portal preview (Draft Mode + a valid
 * Admin Portal session). Identifies the page as an unpublished preview and
 * marks it noindex. Inline styles keep the public stylesheet unchanged.
 */
const bar: CSSProperties = { position: "sticky", top: 0, zIndex: 90, background: "#0a2330", color: "#eef6f6", borderBottom: "1px solid rgba(201,169,97,0.6)" };
const inner: CSSProperties = { maxWidth: 1440, margin: "0 auto", padding: "10px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 24px", fontSize: 13 };
const label: CSSProperties = { marginRight: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#dfc898" };
const button: CSSProperties = { border: "1px solid rgba(238,246,246,0.4)", background: "transparent", color: "inherit", padding: "4px 12px", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" };

export function PreviewBanner() {
  return (
    <div role="region" aria-label="Preview" style={bar}>
      <meta name="robots" content="noindex, nofollow" />
      <div style={inner}>
        <p style={{ margin: 0 }}>
          <span style={label}>Preview · Not published</span>
          Unpublished working copy, visible only to signed-in Admin Portal users.
        </p>
        <form method="post" action="/api/preview/exit">
          <button type="submit" style={button}>
            Exit preview
          </button>
        </form>
      </div>
    </div>
  );
}
