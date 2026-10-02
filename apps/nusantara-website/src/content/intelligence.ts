/**
 * Nusantara intelligence layer — the connective tissue between market data
 * ("what happened"), signals ("what we are watching") and insights ("what it
 * may mean").
 *
 * EVERYTHING IN THIS FILE IS SAMPLE CONTENT FOR MANAGEMENT REVIEW. States and
 * readings are written as interpretive frameworks, not recommendations or
 * statements of current fact, and are labelled as such wherever displayed.
 */
import type { AssetClass } from "@/lib/market/types";

export const INTELLIGENCE_STATUS = {
  label: "Sample states · management review",
  note: "Illustrative Nusantara readings prepared to demonstrate the platform. Not investment recommendations and not forecasts.",
  edition: "October 2026",
};

/* ------------------------------------------------------------------ */
/* Nusantara Market State                                              */
/* ------------------------------------------------------------------ */

export type MarketStateDimension = {
  id: string;
  label: string;
  state: string;
  /** Five-step qualitative scale, low → high. */
  scale: [string, string, string, string, string];
  position: 0 | 1 | 2 | 3 | 4;
  reading: string;
  watching: string[];
  wouldChange: string;
  instruments: string[];
  insight: string;
};

export const MARKET_STATE: MarketStateDimension[] = [
  {
    id: "growth",
    label: "Growth",
    state: "Moderating",
    scale: ["Contracting", "Slowing", "Moderating", "Steady", "Accelerating"],
    position: 2,
    reading:
      "We read momentum as uneven rather than uniformly weak. Breadth across sectors and economies matters more to us than the headline aggregate.",
    watching: ["Breadth of activity indicators", "Direction of earnings revisions", "Labour-market resilience"],
    wouldChange: "Broad-based improvement in activity and revisions would move our reading towards Steady.",
    instruments: ["klci", "jci", "spx"],
    insight: "q4-2026-market-outlook",
  },
  {
    id: "rates",
    label: "Rates",
    state: "Restrictive",
    scale: ["Accommodative", "Easing", "Neutral", "Restrictive", "Tightening"],
    position: 3,
    reading:
      "Policy settings still lean restrictive in our framework. For income allocation, the speed and sequencing of change matter more than the direction alone.",
    watching: ["Front-end versus long-end yields", "Sequencing across central banks", "Inflation breadth"],
    wouldChange: "A sustained, broad decline in inflation pressure would move our reading towards Neutral.",
    instruments: ["us10y", "us2y", "mgs10y"],
    insight: "rates-currencies-and-the-regional-allocator",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    state: "Neutral",
    scale: ["Tight", "Tightening", "Neutral", "Improving", "Abundant"],
    position: 2,
    reading:
      "Funding conditions appear neither a tailwind nor a headwind. We focus on whether liquidity terms in private markets remain aligned with investor needs.",
    watching: ["Funding spreads", "Private-market redemption terms", "Cross-border portfolio flows"],
    wouldChange: "Widening funding spreads or tighter redemption terms would move our reading towards Tightening.",
    instruments: ["usdmyr", "usdsgd"],
    insight: "alternatives-require-more-discipline",
  },
  {
    id: "risk",
    label: "Risk",
    state: "Elevated",
    scale: ["Low", "Contained", "Moderate", "Elevated", "Stressed"],
    position: 3,
    reading:
      "Concentration and valuation dispersion keep our risk reading elevated. This argues for sizing that reflects uncertainty rather than conviction alone.",
    watching: ["Equity concentration", "Realised versus implied volatility", "Credit terms in private lending"],
    wouldChange: "Broader market leadership and stable volatility would move our reading towards Moderate.",
    instruments: ["nasdaq", "spx", "hsi"],
    insight: "the-resilience-lens",
  },
  {
    id: "currencies",
    label: "Currencies",
    state: "Mixed",
    scale: ["Weakening", "Softer", "Mixed", "Firmer", "Strengthening"],
    position: 2,
    reading:
      "Regional currencies are not moving as a bloc in our framework. We treat currency exposure as a documented decision, not a by-product of asset selection.",
    watching: ["Rate differentials versus the US dollar", "Portfolio flows into the region", "Trade balances"],
    wouldChange: "A consistent move across regional currencies would shift our reading towards Firmer or Softer.",
    instruments: ["usdmyr", "usdsgd", "usdidr"],
    insight: "rates-currencies-and-the-regional-allocator",
  },
  {
    id: "commodities",
    label: "Commodities",
    state: "Divergent",
    scale: ["Weak", "Soft", "Divergent", "Firm", "Tight"],
    position: 2,
    reading:
      "Precious metals and energy are telling different stories. We consider precious metals principally through a resilience lens, and energy through its link to inflation.",
    watching: ["Reserve demand for precious metals", "Energy supply and inventories", "Agricultural commodities and regional inflation"],
    wouldChange: "Energy and precious metals moving together would resolve our reading towards Firm or Soft.",
    instruments: ["gold", "brent", "cpo"],
    insight: "precious-metals-and-portfolio-resilience",
  },
];

/* ------------------------------------------------------------------ */
/* Instrument-level views (Signal / Context / Watching / Key risk)    */
/* ------------------------------------------------------------------ */

export type InstrumentView = {
  signal: string;
  /** 0–4 on the instrument's qualitative scale. */
  position: 0 | 1 | 2 | 3 | 4;
  scale: [string, string, string, string, string];
  context: string;
  watching: string;
  risk: string;
  insight: string;
  theme: string;
};

const CLASS_DEFAULT: Record<AssetClass, InstrumentView> = {
  equities: {
    signal: "Selective",
    position: 2,
    scale: ["Defensive", "Cautious", "Selective", "Constructive", "Expansive"],
    context: "Equity outcomes depend heavily on breadth and valuation dispersion. We distinguish flow-driven moves from changes in fundamentals.",
    watching: "Breadth of participation and earnings revisions.",
    risk: "Narrow leadership leaves indices exposed to a small number of companies.",
    insight: "q4-2026-market-outlook",
    theme: "Regional markets",
  },
  fx: {
    signal: "Deliberate",
    position: 2,
    scale: ["Defensive", "Cautious", "Deliberate", "Constructive", "Expansive"],
    context: "Currency exposure is frequently taken unintentionally. We prefer it to be a documented decision — hedged, partially hedged or open.",
    watching: "Rate differentials and portfolio flows.",
    risk: "Currency moves can rival asset returns for cross-border investors.",
    insight: "rates-currencies-and-the-regional-allocator",
    theme: "Rates & currencies",
  },
  rates: {
    signal: "Path-dependent",
    position: 2,
    scale: ["Short duration", "Cautious", "Path-dependent", "Constructive", "Long duration"],
    context: "For income allocation, the sequencing and speed of policy change matter more than direction. We assess duration across several paths.",
    watching: "Shape of the yield curve and inflation breadth.",
    risk: "A position that only works under one policy path is a forecast, not a framework.",
    insight: "rates-currencies-and-the-regional-allocator",
    theme: "Rates & currencies",
  },
  commodities: {
    signal: "Divergent",
    position: 2,
    scale: ["Weak", "Soft", "Divergent", "Firm", "Tight"],
    context: "Commodities respond to supply, inventories and geopolitics as much as to demand.",
    watching: "Supply conditions and inventories.",
    risk: "Price volatility and, for physical exposure, custody and title.",
    insight: "precious-metals-and-portfolio-resilience",
    theme: "Resilience",
  },
};

const SPECIFIC: Record<string, Partial<InstrumentView>> = {
  klci: {
    context: "A concentrated benchmark of large domestic companies. We read it alongside the ringgit, since currency and equity outcomes are linked for regional investors.",
    watching: "Domestic earnings breadth and USD/MYR.",
  },
  sti: {
    context: "A benchmark weighted towards financials and real estate, sensitive to the rate path and regional trade.",
    watching: "Bank margins and real-estate income durability.",
  },
  jci: {
    context: "A broad market where flows can move prices ahead of fundamentals. We separate the two before drawing conclusions.",
    watching: "Portfolio flows and USD/IDR.",
    risk: "Flow reversals can be abrupt in less liquid markets.",
  },
  spx: {
    signal: "Concentrated",
    position: 3,
    scale: ["Broad", "Balanced", "Selective", "Concentrated", "Narrow"],
    context: "Index-level moves can be dominated by a small number of very large companies.",
    watching: "Equal-weight versus cap-weight performance.",
    insight: "the-resilience-lens",
  },
  nasdaq: {
    signal: "Concentrated",
    position: 3,
    scale: ["Broad", "Balanced", "Selective", "Concentrated", "Narrow"],
    context: "Growth-oriented and highly concentrated; sensitive to long-end yields.",
    watching: "Valuation dispersion and long-end yields.",
    insight: "the-resilience-lens",
  },
  usdmyr: { context: "For ringgit-based investors, USD/MYR shapes the outcome of every US-dollar asset.", watching: "Rate differentials and trade balances." },
  usdsgd: { context: "A managed currency regime; moves tend to be measured, but they compound for cross-border portfolios." },
  usdidr: { context: "Sensitive to portfolio flows and the global dollar.", risk: "Flow-driven volatility." },
  gold: {
    signal: "Resilience role",
    position: 3,
    scale: ["Tactical", "Opportunistic", "Strategic", "Resilience role", "Core reserve"],
    context: "We consider gold principally as a portfolio-resilience component rather than a tactical position. Reserve-diversification demand is a key part of that frame.",
    watching: "Official-sector demand and real yields.",
    risk: "No income, price volatility and, for physical holdings, custody and title.",
    insight: "precious-metals-and-portfolio-resilience",
  },
  silver: {
    context: "Part precious metal, part industrial input — which makes it more volatile than gold.",
    insight: "precious-metals-and-portfolio-resilience",
  },
  brent: {
    signal: "Soft",
    position: 1,
    context: "Energy prices feed directly into inflation and into regional trade balances.",
    watching: "Supply decisions and inventories.",
    insight: "q4-2026-market-outlook",
  },
  cpo: {
    context: "A regional agricultural commodity with links to food inflation and to commodity-exporting economies.",
    watching: "Production, inventories and export demand.",
    insight: "q4-2026-market-outlook",
  },
  us10y: { context: "The global reference for duration. Its path influences valuations across equities, credit and real assets.", watching: "Term premium and inflation breadth." },
  us2y: { context: "The most policy-sensitive part of the US curve.", watching: "Policy expectations." },
  mgs10y: { context: "The regional reference for ringgit duration; typically less volatile than US Treasuries.", watching: "Spread to US Treasuries." },
};

export function getInstrumentView(id: string, assetClass: AssetClass): InstrumentView {
  return { ...CLASS_DEFAULT[assetClass], ...SPECIFIC[id] } as InstrumentView;
}

/* ------------------------------------------------------------------ */
/* Cross-asset view (sample Nusantara row)                             */
/* ------------------------------------------------------------------ */

export const CROSS_ASSET_VIEW: Record<AssetClass, { view: string; note: string }> = {
  equities: { view: "Selective", note: "Breadth over headline indices; sizing that reflects concentration." },
  fx: { view: "Deliberate", note: "Currency exposure as a documented decision." },
  rates: { view: "Path-dependent", note: "Duration assessed across several policy paths." },
  commodities: { view: "Divergent", note: "Precious metals for resilience; energy through the inflation lens." },
};

/* ------------------------------------------------------------------ */
/* Markets we monitor (stylised map)                                   */
/* ------------------------------------------------------------------ */

export type MarketNode = {
  id: string;
  name: string;
  /** Position on a stylised 0–100 canvas — schematic, not geographic. */
  x: number;
  y: number;
  index: string | null;
  currency: string | null;
  rate: string | null;
  insight: string;
};

export const MARKET_NODES: MarketNode[] = [
  { id: "us", name: "United States", x: 18, y: 26, index: "spx", currency: null, rate: "us10y", insight: "the-resilience-lens" },
  { id: "jp", name: "Japan", x: 84, y: 40, index: "nikkei", currency: "usdjpy", rate: "jgb10y", insight: "rates-currencies-and-the-regional-allocator" },
  { id: "cn", name: "China / Hong Kong", x: 66, y: 18, index: "hsi", currency: "usdcnh", rate: null, insight: "q4-2026-market-outlook" },
  { id: "my", name: "Malaysia", x: 26, y: 68, index: "klci", currency: "usdmyr", rate: "mgs10y", insight: "rates-currencies-and-the-regional-allocator" },
  { id: "sg", name: "Singapore", x: 52, y: 86, index: "sti", currency: "usdsgd", rate: "sgs10y", insight: "rates-currencies-and-the-regional-allocator" },
  { id: "id", name: "Indonesia", x: 80, y: 70, index: "jci", currency: "usdidr", rate: null, insight: "q4-2026-market-outlook" },
];

/* ------------------------------------------------------------------ */
/* Latest signals and themes                                           */
/* ------------------------------------------------------------------ */

export type Signal = {
  id: string;
  date: string;
  theme: string;
  headline: string;
  reading: string;
  instrument?: string;
  insight: string;
};

export const LATEST_SIGNALS: Signal[] = [
  {
    id: "s1",
    date: "2026-10-02",
    theme: "Precious metals",
    headline: "Gold: we keep the resilience frame",
    reading: "We continue to treat precious metals as a resilience component, not a tactical trade.",
    instrument: "gold",
    insight: "precious-metals-and-portfolio-resilience",
  },
  {
    id: "s2",
    date: "2026-10-01",
    theme: "Rates",
    headline: "Path over direction",
    reading: "For income allocation, sequencing matters more than whether the next move is up or down.",
    instrument: "us10y",
    insight: "rates-currencies-and-the-regional-allocator",
  },
  {
    id: "s3",
    date: "2026-09-30",
    theme: "Currencies",
    headline: "Regional currencies are not a bloc",
    reading: "We assess each currency exposure on its own drivers rather than as a regional basket.",
    instrument: "usdmyr",
    insight: "rates-currencies-and-the-regional-allocator",
  },
  {
    id: "s4",
    date: "2026-09-26",
    theme: "Equities",
    headline: "Concentration is a risk input",
    reading: "When leadership narrows, we treat index concentration as part of the risk assessment.",
    instrument: "spx",
    insight: "the-resilience-lens",
  },
  {
    id: "s5",
    date: "2026-09-22",
    theme: "Private markets",
    headline: "Terms before yield",
    reading: "Where capital is plentiful, covenant quality and structure deserve the closest attention.",
    insight: "private-credit-the-terms-behind-the-yield",
  },
  {
    id: "s6",
    date: "2026-09-17",
    theme: "Commodities",
    headline: "Palm oil and the inflation link",
    reading: "We watch regional agricultural commodities for their pass-through to food inflation.",
    instrument: "cpo",
    insight: "q4-2026-market-outlook",
  },
];

export type Theme = {
  id: string;
  title: string;
  statement: string;
  insights: string[];
  instruments: string[];
  indicators: string[];
};

export const THEMES: Theme[] = [
  {
    id: "governed-allocation",
    title: "Governed allocation",
    statement: "Access is no longer scarce. Selection, governance and monitoring are.",
    insights: ["from-access-to-governed-allocation", "shariah-capable-allocation-shared-principles"],
    instruments: [],
    indicators: ["pw-pool", "fo-formation"],
  },
  {
    id: "rates-currencies",
    title: "Rates & currencies",
    statement: "Duration across paths, and currency exposure as a decision.",
    insights: ["rates-currencies-and-the-regional-allocator", "q4-2026-market-outlook"],
    instruments: ["us10y", "mgs10y", "usdmyr", "usdsgd"],
    indicators: ["macro-policy"],
  },
  {
    id: "alternatives",
    title: "Alternatives & private markets",
    statement: "As alternatives move to the core, liquidity and valuation discipline decide outcomes.",
    insights: ["alternatives-require-more-discipline", "private-credit-the-terms-behind-the-yield"],
    instruments: [],
    indicators: ["pm-credit", "am-alt-share"],
  },
  {
    id: "resilience",
    title: "Resilience",
    statement: "Resilience is designed in advance; it cannot be added during stress.",
    insights: ["the-resilience-lens", "precious-metals-and-portfolio-resilience"],
    instruments: ["gold", "silver"],
    indicators: ["alt-precious"],
  },
  {
    id: "regional-markets",
    title: "Regional markets",
    statement: "Breadth and flows, read separately from headline indices.",
    insights: ["q4-2026-market-outlook", "rates-currencies-and-the-regional-allocator"],
    instruments: ["klci", "sti", "jci"],
    indicators: ["cf-portfolio", "macro-growth"],
  },
  {
    id: "digital-assets",
    title: "Digital assets",
    statement: "Framework first: legal title and custody before efficiency gains.",
    insights: ["tokenisation-a-framework-first-approach"],
    instruments: [],
    indicators: [],
  },
];
