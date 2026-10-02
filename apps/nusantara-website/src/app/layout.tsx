import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PrototypeBanner } from "@/components/layout/PrototypeBanner";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { config } from "@/lib/config";
import { getInsights } from "@/lib/content/repository";
import { getMarketSnapshot } from "@/lib/market/service";
import { statusTitle } from "@/lib/market/status";
import { site } from "@/lib/site";
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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Investing with Perspective`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — Investing with Perspective`,
    description: site.description,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
  // Indexing follows the environment; production only once management decides (src/lib/config.ts).
  robots: config.indexing === "allow" ? { index: true, follow: true } : { index: false, follow: false },
};

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
          <PrototypeBanner />
          <Navbar dataLabel={dataLabel} prototypeNote={prototypeNote} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer prototype={config.isPrototype} scenarioHref={scenarioHref} />
        </MotionProvider>
      </body>
    </html>
  );
}
