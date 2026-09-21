# Executive Vault ↔ SVEGIP UI/UX Alignment Pass

**Status: visual/interaction alignment only. No information architecture, data model, or authentication logic changed.**

Goal: make `apps/executive-vault` (the Personal Executive Command Centre) read as the same design family as `apps/svegip` (the SVE Group Internal Portal) — related, not identical, and never confusable with each other or branded as SVEGIP.

## Reuse assessment (done before implementation, per the brief)

**Reused directly** (same structural/interaction pattern, executed independently in Executive Vault's own CSS — no cross-app file dependency, per the brief's explicit "no risky cross-app dependency" instruction):
- Sidebar architecture: fixed gradient sidebar, grouped nav with small uppercase group labels, active-item inset accent bar + tinted background.
- Topbar: sticky, blurred translucent bar, search + quick action + notifications + avatar.
- Card system: white surface, subtle border, soft shadow, rounded corners (Executive Vault's existing `--radius-lg:16px` and dual-layer shadow already matched SVEGIP's own `--radius`/`--shadow` values — no change needed there).
- Table treatment: sticky uppercase muted header row, bottom-border-only rows, row hover tint.
- Badge/chip pill treatment: rounded-full, tinted background + coloured text pairs.
- Drawer/modal detail-panel header language: an eyebrow-style context line + title + close control — Executive Vault's three drawers (Document Detail, Meeting Brief, Matter Editor) already shared this exact pattern before this pass; confirmed as a genuine existing strength, not something to rebuild.
- Mobile breakpoint convention (820px) and sidebar off-canvas + backdrop-overlay mechanic (SVEGIP's `.portal-nav-overlay`, reused here as `.nav-overlay`, scoped with a media query so it can never darken the desktop screen where the sidebar isn't off-canvas).
- The "eyebrow" label convention (small bold uppercase letter-spaced accent-coloured line above a heading) — added as a new `.eyebrow` utility class.
- Login split-panel structure (brand story panel + form panel, with a decorative ring motif behind the brand panel).

**Adapted** (pattern kept, execution changed to fit Executive Vault's own voice):
- Colour system: kept navy/gold, not SVEGIP's purple/orange — the deliberate differentiator so the two are never mistaken for one another.
- Typography: kept Georgia-serif headings + system-sans body (Executive Vault's own "executive/sophisticated" signature) rather than SVEGIP's Arial-only scale — but adopted SVEGIP's disciplined "named type-scale via CSS custom properties" approach (`--fs-page-title`, `--fw-page-title`, etc.) instead of ad hoc sizes.
- Page header treatment: adopted the eyebrow+title convention, but deliberately did **not** adopt SVEGIP's large decorative gradient "hero" banners — the brief explicitly asked to avoid large decorative cards, and Executive Vault's existing slim `.page-head`/`.summary-strip` pattern already fit that instruction; the hero banner pattern was judged inappropriate for a dense personal command centre and not reused.
- Status-chip visual polish, aligned toward SVEGIP's badge sizing/weight — the underlying semantic vocabulary (classification tiers, lifecycle statuses, Management Visible/Reference/For Review) is unchanged.

**Not reused**:
- SVEGIP's purple/orange brand palette and its uploaded company logo imagery.
- SVEGIP's decorative gradient hero banners, large circular decorative motifs, and "group-strategy-banner" imagery blocks.
- SVEGIP's enterprise modules and business structure (HRMS, payroll, accounting, employee administration, the decision-board kanban) — Executive Vault's information architecture is unchanged.
- A literal shared CSS file or any runtime dependency between the two apps — each app's design tokens are expressed independently in its own `styles.css`, chosen to rhyme with the other's scale (radius, shadow, breakpoint, type-scale *shape*) without coupling the two independently-deployable Netlify sites.

## What changed in Executive Vault

- **Sidebar** (`navSections()`): regrouped into Command / Work / Vault / Management / Connected / System, matching the brief's requested structure. No route was removed — Document Vault bucket shortcuts trimmed from the sidebar (Starred, Working Drafts, Final/Issued) remain one click away as the existing saved-view chips inside "My Document Vault," and the former "Knowledge" function-browsing shortcuts remain reachable via that same screen's Function filter. "Preview Management View" renamed to "Management Progress" in the sidebar (no test or other code depended on the old string).
- **Mobile sidebar**: added a backdrop overlay (click-outside-to-close), scoped by media query so it only ever appears where the sidebar is actually off-canvas (≤820px) — an early version of this without the scope guard incorrectly dimmed the whole desktop screen when the sidebar was toggled; caught and fixed during Playwright verification before commit.
- **Login screen**: rebuilt as a two-panel layout (brand story + decorative ring motif on the left, the sign-in form on the right), structurally adapted from SVEGIP's own login screen, still explicitly reading "Personal Executive Command Centre" and "Ching Yee" — no change to the underlying authentication logic (`submitLogin`/`signOut`/`initApp`/the Netlify Functions) at all.
- **Executive Home / Management Progress**: added an eyebrow label above each page's title ("Personal Executive Command Centre" / "Executive Briefing").
- **Tables**: `.table-wrap` changed from `overflow:hidden` to `overflow:auto` with a `min-width` on the registry table, so dense tables scroll horizontally on narrow viewports instead of silently clipping content — a genuine mobile fix, not just a cosmetic one.
- **Type scale / nav spacing**: page-title bumped to a named `--fs-page-title`/`--fw-page-title` (26px/700), sidebar nav-item padding roomed out slightly to match SVEGIP's proportions.

## Verification

Full automated suite: 88/88 passing (2 tests updated for copy changes — the login-screen "Ching Yee" assertion split into two separate matches since the eyebrow/heading text is no longer one concatenated string; no test asserted the old "Preview Management View" sidebar label). Playwright screenshots taken across desktop/tablet/mobile for the login screen, Executive Home, Document Vault, a Client Workspace, My Day, the Meeting Brief drawer, Management Progress, and both sidebar states, with SVEGIP's own login screen captured alongside for a direct side-by-side comparison. No console/page errors beyond the expected `/api/*` 404s from testing against a plain static server with no backend present (the correct, intended behaviour — see `docs/architecture/executive-command-centre-authentication.md`).
