# platform-services/notifications

**Status: scaffolding only — no implementation.**

Future home of shared notification dispatch (in-app now; email, then push, later) via `packages/shared`'s `NotificationProvider`, decoupled from the business logic that triggers a notification — a domain publishes "leave awaiting approval" or "payslip released," this service handles delivery.

**Depends on:** `platform-services/identity` (recipient resolution), `packages/shared` (`NotificationProvider`).
**Must not depend on:** business domains directly reaching in to format vendor-specific payloads — domains publish structured notification requests, this service handles channel-specific delivery.
**Planned API namespace:** `/api/v1/notifications`.
**Typical data classification:** INTERNAL. Notification bodies must not embed RESTRICTED or PRIVILEGED payloads (e.g. a payslip notification should reference the record, not repeat salary figures in the message body).
