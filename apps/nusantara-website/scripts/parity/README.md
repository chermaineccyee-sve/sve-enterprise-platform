# Public-site parity check

This check compares the public website with a reference build: the frozen Eric
Review Build, commit `e803790`. The candidate passes only if nothing visible
or functional has changed.

```bash
# 1. Reference build in a separate worktree
git worktree add --detach ../nusantara-base e803790
(cd ../nusantara-base/apps/nusantara-website && npm ci && npm run build:review && npx next start -p 3101)

# 2. Candidate build (this checkout), local content source
CONTENT_SOURCE=local npm run build:review && npx next start -p 3102

# 3. Compare
node scripts/parity/parity.mjs --base http://localhost:3101 --head http://localhost:3102 --out parity-out
```

The check covers every URL in the reference sitemap, plus 404s, the metadata
files and the public API routes. For each one it compares:

1. **Response.** HTTP status, content type and security headers.
2. **HTML.** Build-specific noise is removed first: hashed `/_next/static`
   paths, inline framework scripts, React `useId` values and Suspense markers.
3. **CSS.** The stylesheets each page actually links, compared by content.
4. **API and files.** JSON bodies (with timestamps normalised) and binary
   files (SHA-256).
5. **Screenshots.** Full page, desktop 1440×900 and mobile 390×844, with the
   browser clock fixed and reduced motion, compared pixel by pixel.
   - Before capture, each page is resized to its full height and allowed to
     settle, so charts do not redraw mid-capture.
   - A pair that still differs is compared against two fresh loads of the
     reference. It passes only if the difference falls within the
     reference's own load-to-load variation, such as anti-aliasing on live
     charts.
   - Such pairs are listed under `unstable` in `parity-report.json`.

The exit code is 0 only when everything matches.
