# packages/types

**Status: contracts only — no runtime, no build tooling wired up yet.**

Shared TypeScript types used across `platform-services/*` once implementation begins: the entity/organisation model, the `/api/v1` response envelope, and the audit event contract. These are plain `.ts` interface/type declarations with no dependencies and no implementation logic — intentionally not wired into an npm workspace or build yet (see `docs/architecture/platform-architecture.md` "Deferred tooling" note). They exist now so every future service designs against the same shapes from day one instead of each inventing its own.

- `src/entity-context.ts` — group / legal entity / business unit / department / entity-access model, and the `DataClassification` levels.
- `src/api.ts` — `ApiResponse`, `ApiError`, pagination, and correlation ID conventions (see `docs/architecture/api-conventions.md`).
- `src/audit-event.ts` — the future audit event contract (see `docs/architecture/security-architecture.md`).
