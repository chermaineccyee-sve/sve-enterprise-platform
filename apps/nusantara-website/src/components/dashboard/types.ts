export type { MarketIntel } from "@/content/model/market-intel";

/** A published Market State dimension, as previewed inside the dashboard (content, resolved on the server). */
export type DimensionPreview = {
  id: string;
  label: string;
  state: string;
  stance: { scale: readonly string[]; position: number };
  summary: string;
  /** Instrument ids, in the edition's order. */
  supportingMarkets: string[];
};
