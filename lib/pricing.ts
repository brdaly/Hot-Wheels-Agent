import ireland from "../data/ireland-retail-2026-08-02.json";
import unitedStates from "../data/us-retail-2026-08-27.json";
import type { CarObservation, PhotoAnalysis, ProductCategory } from "./analysis-schema";

export const PRICE_POLICY_VERSION = "retail-gate-v2.0";
export const RETAIL_SNAPSHOT_TTL_DAYS = 45;
export type PriceVerdict = "strong_buy" | "fair" | "caution" | "overpriced" | "unknown";
type USBenchmark = (typeof unitedStates.benchmarks)[number];
type IrelandBenchmark = (typeof ireland.benchmarks)[number];

function snapshotFreshness(asOf: string, now = new Date()) {
  const observed = Date.parse(`${asOf}T00:00:00Z`);
  const ageDays = Number.isFinite(observed) ? Math.floor((now.getTime() - observed) / 86_400_000) : Number.POSITIVE_INFINITY;
  return {
    asOf,
    ageDays,
    status: ageDays >= 0 && ageDays <= RETAIL_SNAPSHOT_TTL_DAYS ? "current" as const : "stale" as const,
  };
}

function evaluateBenchmark(
  row: USBenchmark | IrelandBenchmark | undefined,
  price: number | null | undefined,
  currency: string,
  expectedCurrency: string,
  asOf: string,
  marketLabel: string,
  now = new Date(),
) {
  const freshness = snapshotFreshness(asOf, now);
  if (price == null) return { verdict: "unknown" as PriceVerdict, note: "Add an item-specific shelf price for a price gate.", freshness };
  if (currency !== expectedCurrency) return { verdict: "unknown" as PriceVerdict, note: `Price is in ${currency}; no exchange-rate conversion was assumed.`, freshness };
  if (!row) return { verdict: "unknown" as PriceVerdict, note: `No verified ${marketLabel} benchmark for this product category.`, freshness };
  if (freshness.status === "stale") return { verdict: "unknown" as PriceVerdict, note: `The ${marketLabel} retail snapshot is stale and must be refreshed.`, benchmark: row, freshness };
  if (price <= row.strongBuyAtOrBelow) return { verdict: "strong_buy" as PriceVerdict, note: `Strong versus the current ${row.retailer} retail benchmark.`, benchmark: row, freshness };
  if (price <= row.normalPrice) return { verdict: "fair" as PriceVerdict, note: `At or below normal ${marketLabel} retail.`, benchmark: row, freshness };
  if (price <= row.normalPrice * 1.2) return { verdict: "caution" as PriceVerdict, note: "Small retail premium—require exact-release strength.", benchmark: row, freshness };
  return { verdict: "overpriced" as PriceVerdict, note: "Above current retail; require verified exact completed-sale evidence.", benchmark: row, freshness };
}

export function evaluateUSPrice(category: ProductCategory | string, price?: number | null, currency = "USD", now = new Date()) {
  if (category === "unknown") {
    return { verdict: "unknown" as PriceVerdict, note: "Product category is unresolved; no mainline benchmark was assumed.", freshness: snapshotFreshness(unitedStates.asOf, now) };
  }
  return evaluateBenchmark(
    unitedStates.benchmarks.find((item) => item.category === category),
    price,
    currency,
    "USD",
    unitedStates.asOf,
    "US",
    now,
  );
}

export function evaluateIrishPrice(category: ProductCategory | string, price?: number | null, currency = "EUR", now = new Date()) {
  if (category === "unknown") {
    return { verdict: "unknown" as PriceVerdict, note: "Product category is unresolved; no mainline benchmark was assumed.", freshness: snapshotFreshness(ireland.asOf, now) };
  }
  return evaluateBenchmark(
    ireland.benchmarks.find((item) => item.category === category),
    price,
    currency,
    "EUR",
    ireland.asOf,
    "Irish",
    now,
  );
}

export function inferPriceCategory(line: string): ProductCategory {
  const value = line.toLowerCase();
  if (value.includes("team transport")) return "team_transport";
  if (value.includes("formula 1") || /\bf1\b/.test(value)) return "premium_f1_single";
  if (value.includes("silver")) return "silver_series";
  if (value.includes("2-pack") || value.includes("two-pack")) return "premium_2_pack";
  if (value.includes("display") || value.includes("4-pack")) return "premium_4_pack";
  if (value.includes("elite 64")) return "elite_64";
  if (value.includes("red line club") || /\brlc\b/.test(value)) return "rlc";
  if (value.includes("convention")) return "convention";
  if (value.includes("collector edition")) return "collector_edition";
  if (value.includes("5-pack") || value.includes("five-pack")) return "five_pack";
  if (["car culture", "boulevard", "premium", "fast & furious"].some((item) => value.includes(item))) return "premium_single";
  if (value.includes("mainline")) return "mainline_single";
  return "unknown";
}

export function resolveItemPrice(
  observation: CarObservation,
  analysis: PhotoAnalysis,
  options: { observedPrice?: number; currency?: string },
) {
  if (observation.priceObservation.amount != null) {
    return {
      amount: observation.priceObservation.amount,
      currency: observation.priceObservation.currency,
      source: "item_visual_evidence" as const,
      evidence: observation.priceObservation.evidence,
    };
  }
  if (analysis.cars.length === 1 && options.observedPrice != null) {
    return { amount: options.observedPrice, currency: options.currency ?? "USD", source: "collector_item_input" as const, evidence: "Collector-entered price for the single result" };
  }
  if (analysis.cars.length === 1 && analysis.scene.unassignedPriceObserved != null) {
    return { amount: analysis.scene.unassignedPriceObserved, currency: analysis.scene.currency, source: "single_item_scene_evidence" as const, evidence: "Only one car is present in the scene" };
  }
  return { amount: null, currency: "unknown", source: "unassigned" as const, evidence: analysis.cars.length > 1 ? "A scene-level price cannot be safely assigned across multiple cars" : null };
}
