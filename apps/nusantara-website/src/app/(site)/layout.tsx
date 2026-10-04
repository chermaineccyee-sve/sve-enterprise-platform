import type { Metadata, ResolvingMetadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PrototypeBanner } from "@/components/layout/PrototypeBanner";
import { MarketTimeProvider } from "@/components/market/MarketTime";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { config } from "@/lib/config";
import { getInsights } from "@/lib/content/repository";
import { renderTimestamp } from "@/lib/market/illustrative-time";
import { getMarketSnapshot } from "@/lib/market/service";
import { statusTitle } from "@/lib/market/status";
import { siteMetadata } from "./metadata";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
  weight: ["400", "500", "600"],
});

/**
 * The site's share image is the code-controlled file app/opengraph-image.jpg.
 * It sits at the app root (outside this route group) so its public URL stays
 * /opengraph-image.jpg; Next.js resolves it on the parent segment, so it is
 * carried into this layout's openGraph here.
 */
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  // Re-expressed as site-relative URLs so this layout's metadataBase applies, as before.
  const images = ((await parent).openGraph?.images ?? []).map((i) => {
    const image = typeof i === "string" ? { url: i } : i;
    const u = new URL(String(image.url));
    return { ...image, url: u.pathname + u.search };
  });
  return { ...siteMetadata, openGraph: { ...siteMetadata.openGraph, ...(images.length ? { images } : {}) } };
}

export const viewport: Viewport = {
  themeColor: "#12384a",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [{ provenance }, insights] = await Promise.all([getMarketSnapshot(), getInsights()]);
  const scenario = insights.find((i) => i.body.some((b) => b.type === "scenario"));
  const scenarioHref = scenario ? `/insights/${scenario.slug}#scenario` : null;
  const dataLabel = provenance.status === "unavailable" ? "Data unavailable" : `${statusTitle(provenance)} data`;
  const prototypeNote = config.isPrototype ? "Management-review prototype. Market information shown on this website is illustrative." : null;
  return (
    <html lang="en-GB" className={`${newsreader.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script
          // Marks the document as JS-capable so entrance motion never hides content without JS.
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
      </head>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-teal-800 focus:px-4 focus:py-3 focus:text-white"
        >
          Skip to main content
        </a>
        <MotionProvider>
          {/* Render time seeds the illustrative snapshot date for server render and hydration; the browser then keeps it current. */}
          <MarketTimeProvider renderedAt={renderTimestamp()}>
          <PrototypeBanner />
          <Navbar dataLabel={dataLabel} prototypeNote={prototypeNote} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer prototype={config.isPrototype} scenarioHref={scenarioHref} />
          </MarketTimeProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
