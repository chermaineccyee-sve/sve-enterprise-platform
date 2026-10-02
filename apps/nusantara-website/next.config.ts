import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Make the deployment mode visible in every build/start log (no secrets printed).
{
  const env = process.env.NUSANTARA_ENV === "staging" || process.env.NUSANTARA_ENV === "production" ? process.env.NUSANTARA_ENV : "review";
  const provider = process.env.MARKET_DATA_PROVIDER ?? (env === "review" ? "illustrative" : "unconfigured → UNAVAILABLE");
  console.info(`Nusantara · environment: ${env === "review" ? "MANAGEMENT REVIEW" : env.toUpperCase()} · market data: ${provider}`);
}

/**
 * Content Security Policy. Everything is served from this origin: fonts are
 * self-hosted by next/font, market data and enquiries go through this site's
 * own /api routes (providers are called server-side only), and no third-party
 * scripts or trackers are loaded. 'unsafe-inline' remains for Next.js's
 * inline bootstrap and JSON-LD scripts; moving to nonces is a production
 * hardening step (docs/ARCHITECTURE.md). Development needs 'unsafe-eval'.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS only matters over HTTPS; harmless elsewhere and required for production hosting.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
