# Brand source

- `nusantara-logo-master.webp` — the master logo exactly as supplied for the website
  ("Nusantara Logo (Transparent)"; received via the chat upload as WebP, 1324 × 1188,
  transparent background). Never edit this file.
- `derive-renditions.mjs` — derives the header renditions in `public/brand/`
  (`nusantara-logo-h66@{1,2,3}x.png`, `nusantara-logo-h84@{1,2,3}x.png`): fully
  transparent margin removed, resized with Lanczos, saved as lossless PNG with alpha.
  No recolouring, redrawing, sharpening or cropping of the artwork.

- `derive-footer-renditions.mjs` — derives the footer (dark teal ground) renditions
  `public/brand/nusantara-logo-footer-h116@{1,2,3}x.png`: same trim and resize, with
  only the near-black wordmark given the site's ivory (`--color-ivory`, #f7f3ea) so it reads on the dark ground. The
  emblem, the gold full stop and every pixel's alpha are unchanged (verified identical
  to an unmodified resize). Replace with an official light-wordmark asset if one is
  issued.
