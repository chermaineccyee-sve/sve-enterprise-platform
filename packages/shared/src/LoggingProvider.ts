/**
 * Structured logging provider contract. Contract only — no implementation.
 *
 * apps/svegip uses plain console.error today — sufficient pre-production,
 * insufficient for the "suspicious login detection" target noted in
 * SVEGIP_ENTERPRISE_ASSESSMENT.md §AE. This contract lets local structured
 * logging and CloudWatch be interchangeable later. Never log secret values,
 * full session tokens, or PRIVILEGED-classified data — see
 * docs/architecture/security-architecture.md "Sensitive-data handling".
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggingProvider {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
}
