# packages/security

**Status: contracts only — no implementation, no MFA, no Identity build. Explicitly out of scope for this PR.**

Provider interfaces and the RBAC/session model contract that make identity and secrets handling portable across hosting environments (SVE private server, AWS, Netlify) instead of tying business logic to one vendor's SDK — the gap identified in `SVEGIP_ENTERPRISE_ASSESSMENT.md` §AC/§AD, where `apps/svegip`'s functions import `@netlify/database`/`Netlify.env.get()` directly.

- `src/AuthProvider.ts` — authentication contract (local password auth today; AWS Cognito, enterprise SSO, WebAuthn/passkeys later — see `docs/architecture/deployment-portability.md`).
- `src/SecretsProvider.ts` — secret retrieval contract (environment variables today; AWS Secrets Manager or a private vault later).
- `src/rbac.ts` — `Role`, `Permission`, `SessionContext`, and step-up authentication contract shapes.

None of this is wired into `apps/svegip`, which keeps using its existing, working `_auth-core.mts` unchanged.
