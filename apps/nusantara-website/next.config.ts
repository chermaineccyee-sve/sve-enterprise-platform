import { withPayload } from "@payloadcms/next/withPayload";
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

/**
 * Admin Portal (/admin) and its API (/api/cms): never indexed, never framed,
 * no caching of authenticated responses. Its CSP differs from the site's only
 * where the Payload admin UI needs it (and the S3 bucket for direct uploads).
 * Later rules override earlier ones for the same header.
 */
const s3Origin = process.env.S3_BUCKET ? ` https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || "ap-southeast-1"}.amazonaws.com` : "";
const adminCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${s3Origin}`,
  "font-src 'self' data:",
  `connect-src 'self'${s3Origin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
const adminHeaders = [
  { key: "Content-Security-Policy", value: adminCsp },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "private, no-store" },
];
// Payload's colour-scheme client hints, scoped to the Admin Portal (withPayload would add them site-wide).
const adminClientHints = [
  { key: "Accept-CH", value: "Sec-CH-Prefers-Color-Scheme" },
  { key: "Vary", value: "Sec-CH-Prefers-Color-Scheme" },
  { key: "Critical-CH", value: "Sec-CH-Prefers-Color-Scheme" },
];

async function headers() {
  return [
    { source: "/:path*", headers: securityHeaders },
    { source: "/admin", headers: [...adminHeaders, ...adminClientHints] },
    { source: "/admin/:path*", headers: [...adminHeaders, ...adminClientHints] },
    { source: "/api/cms/:path*", headers: adminHeaders },
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets a second build (e.g. the CMS-source parity build) sit beside the default .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  headers,
  // Two root layouts (public site, Admin Portal): unmatched URLs use app/global-not-found.tsx.
  experimental: { globalNotFound: true },
};

// withPayload adds Payload's build settings (server externals etc.). Its
// headers() is replaced by ours so the public site's headers stay unchanged.
export default { ...withPayload(nextConfig), headers } satisfies NextConfig;
