# Deployment Portability

Status: documentation only. **No production infrastructure is provisioned by this PR — no AWS resources, no server configuration, nothing in `infra/*` beyond placeholder `README.md` files.**

## Why this matters

`apps/svegip` today imports `@netlify/database`, `@netlify/functions`, and `@netlify/edge-functions` directly in its function handlers, and reads secrets via the Netlify-specific `Netlify.env.get(...)` global — verified in `SVEGIP_ENTERPRISE_ASSESSMENT.md` §AC/§AD. This makes it fully functional on Netlify today but not portable without rewriting every function's transport layer. `platform-services/*` is designed from the start to avoid repeating this: business logic depends on the provider contracts in `packages/security`/`packages/shared`, never on a hosting vendor's SDK directly. `apps/svegip` itself is not being migrated by this PR — it keeps running on Netlify exactly as it does today.

## SVE private/internal server (target components)

| Component | Role |
|---|---|
| Reverse proxy (e.g. Nginx) | TLS termination, routing to application containers |
| Application runtime | Runs `platform-services/*` behind the API layer (containerised — see `infra/local` for the eventual local-dev equivalent) |
| PostgreSQL | Primary datastore, via `DatabaseProvider` |
| Private object storage | Document/file storage, via `StorageProvider` |
| Secrets | Environment-injected or a private vault, via `SecretsProvider` |
| Logs | Structured local logging, via `LoggingProvider` |
| Backup/recovery | Scheduled PostgreSQL and object-storage backups; restore procedure documented once a real backup target exists — not designed in this PR |

## AWS (future-compatible components)

| Component | Role |
|---|---|
| Route 53 / CloudFront / WAF | DNS, CDN, edge protection |
| ALB / API Gateway | Routes to the application layer |
| ECS/Fargate (or equivalent) | Runs `platform-services/*` |
| RDS PostgreSQL | `DatabaseProvider` implementation |
| S3 | `StorageProvider` implementation |
| Cognito | Possible `AuthProvider` implementation (one option among several — see `packages/security/src/AuthProvider.ts`; not a commitment to Cognito specifically) |
| Secrets Manager | `SecretsProvider` implementation |
| KMS | Encryption-at-rest key management, per `security-architecture.md` "Encryption expectations" |
| CloudWatch | `LoggingProvider` implementation |

AWS is documented as a *possible* deployment target because the provider contracts make it one — this is not a decision to deploy on AWS, and no AWS account, resource, or credential is touched by this repository.

## Portability principle

Application/domain-service code must never import a hosting vendor's SDK directly (`@netlify/*`, `aws-sdk`, etc.) — only a concrete provider implementation, wired once in `platform-services/core`, does that. A service written against `DatabaseProvider`/`StorageProvider`/`SecretsProvider`/`LoggingProvider`/`AuthProvider`/`NotificationProvider` should be deployable to either target by swapping the concrete implementations bound in `core`, with zero changes to the domain service itself.

## Environment conventions

Three environments, consistently named across every future service and `infra/*` configuration:

| Environment | Purpose | Data |
|---|---|---|
| `development` | Local development (`infra/local`) | Synthetic/seed data only |
| `staging` | Pre-production validation, mirrors production topology | Representative non-confidential data only — following the same discipline `apps/svegip`'s own `svegip-staging` Netlify project already applies |
| `production` | Live | Real data, full security controls active |

`packages/config/src/environment.ts`'s `EnvironmentName` type is exactly these three values — no ad hoc fourth environment name should appear in code or config. Every `.env.example` (see `apps/svegip/.env.example` for the existing pattern) documents variable *names* and safe placeholders only, per environment where values genuinely differ — never real credentials, for any environment, in this repository.
