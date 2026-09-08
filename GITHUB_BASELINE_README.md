# SVEGIP GitHub Baseline — V26.2

This package establishes the approved SVEGIP Phase 1 baseline for migration into GitHub.

Baseline: V26.2 Functional Correction
Status: Main portal accepted for desktop and mobile review.

## Repository model
- `main` — stable / approved source
- `develop` — integration branch
- `feature/data-vault-rebuild` — isolated Data Vault rebuild

## Important
The Data Vault in this baseline is not treated as production-ready. Later V26.3/V26.4 routing patches are intentionally not incorporated as the development baseline. Data Vault navigation and project/matter routing should be rebuilt cleanly on the feature branch and browser-tested before merge.

Do not commit secrets. Runtime secrets remain in deployment environment variables.
