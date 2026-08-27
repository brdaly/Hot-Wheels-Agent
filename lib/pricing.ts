import ireland from "../data/ireland-retail-2026-08-02.json";
export type PriceVerdict = "strong_buy" | "fair" | "caution" | "overpriced" | "unknown";
export function evaluateIrishPrice(category: string, price?: number | null) {
  if (price == null) return { verdict: "unknown" as PriceVerdict, note: "Add the shelf price for a price gate." };
  const row = ireland.benchmarks.find((item) => item.category === category);
  if (!row) return { verdict: "unknown" as PriceVerdict, note: "No verified regional benchmark for this category." };
  if (price <= row.strongBuyAtOrBelow) return { verdict: "strong_buy" as PriceVerdict, note: `Strong versus ${row.retailer} benchmark.`, benchmark: row };
  if (price <= row.normalPrice) return { verdict: "fair" as PriceVerdict, note: "At or below normal Irish retail.", benchmark: row };
  if (price <= row.normalPrice * 1.2) return { verdict: "caution" as PriceVerdict, note: "Small premium—require exact-version strength.", benchmark: row };
  return { verdict: "overpriced" as PriceVerdict, note: "Above regional retail; verify exact sold comps.", benchmark: row };
}
export function inferPriceCategory(line: string) { const v = line.toLowerCase(); if (v.includes("team transport")) return "team_transport"; if (v.includes("formula 1") || v.includes("f1")) return "premium_f1_single"; if (v.includes("silver")) return "silver_series"; if (v.includes("2-pack") || v.includes("two-pack")) return "premium_2_pack"; if (v.includes("display") || v.includes("4-pack")) return "premium_4_pack"; if (["car culture", "boulevard", "premium", "fast & furious"].some((x) => v.includes(x))) return "premium_single"; return "mainline_single"; }
