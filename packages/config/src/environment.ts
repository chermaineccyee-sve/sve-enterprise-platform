/**
 * Environment/config conventions. Contract only — no implementation, no real
 * values. See docs/architecture/deployment-portability.md "Environment
 * conventions" for the full dev/staging/production matrix this supports.
 */
export type EnvironmentName = "development" | "staging" | "production";

export interface ConfigProvider {
  environment: EnvironmentName;
  /** Reads a named, non-secret config value (feature flags, base URLs, etc.). */
  get(key: string): string | undefined;
}
