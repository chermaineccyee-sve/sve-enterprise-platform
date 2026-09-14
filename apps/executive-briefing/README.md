# SVE Group Enterprise Platform — Executive Briefing

An interactive, executive-facing presentation explaining how SVEGIP is evolving
into the SVE Group Enterprise Platform. Intended audience: senior management
(initially Eric Tang).

**This app is completely isolated from `apps/svegip/` and from every
`platform-services/*`/`packages/*` module.** It does not import, fetch, link to,
or depend on any of them — it is a standalone static site with its own copied
brand assets. It has no backend, no authentication, and no database.

## Status

**Phase 1 only.** Three screens are implemented:

1. Executive Opening
2. From Prototype to Platform
3. Enterprise Platform Architecture

Screens 04–15 (People/HRMS, Payroll, Governance, Deployment, Roadmap, etc.) are
directional only (see the root `SVEGIP_ENTERPRISE_ASSESSMENT.md` and
`docs/architecture/`) and are **not** built here. The navigation chrome
(`SCREENS` array in `app.js`) is structured so they can be appended later
without a redesign — see `app.js`'s top comment.

## Stack

Vanilla HTML/CSS/JS. No framework, no bundler, no build step — matches
`apps/svegip`'s own convention. `package.json` has no runtime dependencies;
`test` runs Node's built-in test runner (`node --test`) against `test/*.mjs`.

## Structure

```
index.html     entry point
styles.css     design tokens (values copied from apps/svegip, not imported) + layout/motion
app.js         screen registry, navigation, Screen 02/03 interaction logic, rendering
assets/        copied brand assets (sve-logo.jpeg)
test/          node:test suites, run with `npm test`
```

## Status-tag system

Every module/capability on Screen 03 (and every capability on Screen 02) is
tagged with exactly one of four states, so the briefing stays credible under
technical due diligence:

- **Working / Implemented** — real, running, tested code exists today.
- **Architecture Defined** — a documented contract/boundary exists (an
  interface file, or a `platform-services/*` README describing dependencies,
  API namespace and data classification); no business logic yet.
- **Planned Development** — named in a roadmap document; no scaffolding exists.
- **Future Capability** — directional only; not represented anywhere in the
  repository yet.

The exact status assigned to each module is grounded in the repository
inspection carried out before this app was built, not asserted from the
narrative brief. In particular: Payroll, iClaims and Accounting Pro are always
"Architecture Defined," never "Working"; the Data Vault module explicitly
carries a "UI integration pending" caveat alongside its "Working" tag, because
its new server-side architecture is real and tested but the visible Data Vault
screen has not been switched over to it yet.

## Running locally

Any static file server works, e.g.:

```
npx --yes http-server apps/executive-briefing
```

or simply open `index.html` directly in a browser.

## Tests

```
cd apps/executive-briefing
npm test
```
