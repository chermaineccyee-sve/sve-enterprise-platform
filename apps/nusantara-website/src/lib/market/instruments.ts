import type { AssetClass, InstrumentDefinition } from "./types";

/**
 * Instrument catalogue — the single list of instruments the website can
 * display. Providers map these ids to their own vendor symbols.
 */
export const INSTRUMENTS: InstrumentDefinition[] = [
  // Equities
  { id: "klci", name: "FTSE Bursa Malaysia KLCI", shortName: "KLCI", ticker: "FBMKLCI", assetClass: "equities", region: "Asia", market: "Malaysia", currency: "MYR", decimals: 2, convention: "price", description: "Benchmark index of 30 large listed companies in Malaysia." },
  { id: "sti", name: "Straits Times Index", shortName: "STI", ticker: "STI", assetClass: "equities", region: "Asia", market: "Singapore", currency: "SGD", decimals: 2, convention: "price", description: "Benchmark index of 30 large listed companies in Singapore." },
  { id: "jci", name: "Jakarta Composite Index", shortName: "Jakarta Comp.", ticker: "JCI", assetClass: "equities", region: "Asia", market: "Indonesia", currency: "IDR", decimals: 2, convention: "price", description: "Broad index of companies listed in Indonesia." },
  { id: "nikkei", name: "Nikkei 225", shortName: "Nikkei 225", ticker: "N225", assetClass: "equities", region: "Asia", market: "Japan", currency: "JPY", decimals: 2, convention: "price", description: "Price-weighted index of 225 large companies listed in Japan." },
  { id: "hsi", name: "Hang Seng Index", shortName: "Hang Seng", ticker: "HSI", assetClass: "equities", region: "Asia", market: "Hong Kong", currency: "HKD", decimals: 2, convention: "price", description: "Benchmark index of large companies listed in Hong Kong." },
  { id: "spx", name: "S&P 500", shortName: "S&P 500", ticker: "SPX", assetClass: "equities", region: "Americas", market: "United States", currency: "USD", decimals: 2, convention: "price", description: "Index of 500 leading US-listed companies." },
  { id: "nasdaq", name: "Nasdaq Composite", shortName: "Nasdaq", ticker: "IXIC", assetClass: "equities", region: "Americas", market: "United States", currency: "USD", decimals: 2, convention: "price", description: "Broad index of companies listed on the Nasdaq exchange." },

  // FX
  { id: "usdmyr", name: "US Dollar / Malaysian Ringgit", shortName: "USD/MYR", ticker: "USDMYR", assetClass: "fx", region: "Asia", market: "Malaysia", currency: "MYR", decimals: 4, convention: "price", description: "Ringgit per US dollar." },
  { id: "usdsgd", name: "US Dollar / Singapore Dollar", shortName: "USD/SGD", ticker: "USDSGD", assetClass: "fx", region: "Asia", market: "Singapore", currency: "SGD", decimals: 4, convention: "price", description: "Singapore dollars per US dollar." },
  { id: "usdidr", name: "US Dollar / Indonesian Rupiah", shortName: "USD/IDR", ticker: "USDIDR", assetClass: "fx", region: "Asia", market: "Indonesia", currency: "IDR", decimals: 0, convention: "price", description: "Rupiah per US dollar." },
  { id: "sgdmyr", name: "Singapore Dollar / Malaysian Ringgit", shortName: "SGD/MYR", ticker: "SGDMYR", assetClass: "fx", region: "Asia", market: "Malaysia", currency: "MYR", decimals: 4, convention: "price", description: "Ringgit per Singapore dollar." },
  { id: "eurusd", name: "Euro / US Dollar", shortName: "EUR/USD", ticker: "EURUSD", assetClass: "fx", region: "Europe", market: "Euro area", currency: "USD", decimals: 4, convention: "price", description: "US dollars per euro." },
  { id: "usdcnh", name: "US Dollar / Chinese Yuan (CNH)", shortName: "USD/CNH", ticker: "USDCNH", assetClass: "fx", region: "Asia", market: "China", currency: "CNH", decimals: 4, convention: "price", description: "Yuan (CNH) per US dollar." },
  { id: "usdjpy", name: "US Dollar / Japanese Yen", shortName: "USD/JPY", ticker: "USDJPY", assetClass: "fx", region: "Asia", market: "Japan", currency: "JPY", decimals: 2, convention: "price", description: "Yen per US dollar." },

  // Rates
  { id: "us10y", name: "US Treasury 10-Year Yield", shortName: "US 10Y", ticker: "UST10Y", assetClass: "rates", region: "Americas", unit: "%", market: "United States", currency: "USD", decimals: 3, convention: "yield", description: "Yield on the benchmark 10-year US Treasury note." },
  { id: "us2y", name: "US Treasury 2-Year Yield", shortName: "US 2Y", ticker: "UST2Y", assetClass: "rates", region: "Americas", unit: "%", market: "United States", currency: "USD", decimals: 3, convention: "yield", description: "Yield on the 2-year US Treasury note." },
  { id: "mgs10y", name: "Malaysian Government Securities 10-Year", shortName: "MGS 10Y", ticker: "MGS10Y", assetClass: "rates", region: "Asia", unit: "%", market: "Malaysia", currency: "MYR", decimals: 3, convention: "yield", description: "Benchmark 10-year Malaysian government bond yield." },
  { id: "jgb10y", name: "Japanese Government Bond 10-Year", shortName: "JGB 10Y", ticker: "JGB10Y", assetClass: "rates", region: "Asia", unit: "%", market: "Japan", currency: "JPY", decimals: 3, convention: "yield", description: "Benchmark 10-year Japanese government bond yield." },
  { id: "sgs10y", name: "Singapore Government Securities 10-Year", shortName: "SGS 10Y", ticker: "SGS10Y", assetClass: "rates", region: "Asia", unit: "%", market: "Singapore", currency: "SGD", decimals: 3, convention: "yield", description: "Benchmark 10-year Singapore government bond yield." },

  // Commodities
  { id: "gold", name: "Gold Spot", shortName: "Gold", ticker: "XAUUSD", assetClass: "commodities", region: "Global", unit: "USD/oz", market: "Global", currency: "USD", decimals: 2, convention: "price", description: "Spot gold price in US dollars per troy ounce." },
  { id: "silver", name: "Silver Spot", shortName: "Silver", ticker: "XAGUSD", assetClass: "commodities", region: "Global", unit: "USD/oz", market: "Global", currency: "USD", decimals: 2, convention: "price", description: "Spot silver price in US dollars per troy ounce." },
  { id: "brent", name: "Brent Crude Oil", shortName: "Brent", ticker: "BRENT", assetClass: "commodities", region: "Global", unit: "USD/bbl", market: "Global", currency: "USD", decimals: 2, convention: "price", description: "Front-month Brent crude oil futures." },
  { id: "cpo", name: "Crude Palm Oil", shortName: "CPO", ticker: "FCPO", assetClass: "commodities", region: "Asia", unit: "MYR/t", market: "Malaysia", currency: "MYR", decimals: 0, convention: "price", description: "Third-month crude palm oil futures." },
  { id: "copper", name: "Copper", shortName: "Copper", ticker: "CU", assetClass: "commodities", region: "Global", unit: "USD/t", market: "Global", currency: "USD", decimals: 0, convention: "price", description: "Benchmark copper price in US dollars per tonne." },
];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equities: "Equities",
  fx: "FX",
  rates: "Rates",
  commodities: "Commodities",
};

/** Curated selection for the homepage Market Pulse. */
export const PULSE_INSTRUMENT_IDS = ["klci", "sti", "jci", "spx", "usdmyr", "usdsgd", "gold", "brent", "cpo", "us10y"];

/** Instruments on the dashboard's Overview tab. */
export const OVERVIEW_INSTRUMENT_IDS = ["klci", "sti", "jci", "spx", "nasdaq", "usdmyr", "usdsgd", "usdidr", "sgdmyr", "gold", "brent", "cpo", "us10y"];

export function getInstrument(id: string) {
  return INSTRUMENTS.find((i) => i.id === id);
}
