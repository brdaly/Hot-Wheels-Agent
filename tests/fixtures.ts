import type { CarObservation } from "../lib/analysis-schema";

export const ferrari: CarObservation = {
  observationId: "car-1",
  identification: {
    brand: "Hot Wheels",
    casting: "Ferrari Testarossa",
    tooling: "Ferrari Testarossa",
    releaseYear: 2026,
    line: "Car Culture",
    category: "premium_single",
    seriesOrMix: "Modern Classics",
    collectorNumber: "3/5",
    colorOrLivery: "Red",
    productCode: "TEST01",
    wheelType: "Real Riders",
    chaseStatus: "none",
    chaseMarkersObserved: [],
    cardType: "premium",
    region: "US",
    confidence: "high",
  },
  decisionFeatures: {
    releaseClass: "premium",
    castingSignals: ["licensed_vehicle", "historically_significant_model"],
    executionSignals: ["metal_body", "metal_chassis", "real_riders", "detailed_livery", "premium_card"],
    cultureLanes: ["ferrari"],
    featureEvidence: ["Ferrari road car", "Real Riders visible", "Premium card visible"],
  },
  marketEvidence: { exactSoldComps: [], notes: ["No verified completed-sale dataset attached"] },
  condition: { grade: "excellent", card: [], blister: [], visibleError: null },
  priceObservation: { amount: null, currency: "unknown", evidence: null },
  evidenceObserved: ["casting name", "series", "premium card", "color", "Real Riders", "collector number"],
  verificationNeeded: [],
};

export function withExactSoldComps(observation = ferrari, count = 5): CarObservation {
  return {
    ...observation,
    marketEvidence: {
      notes: [],
      exactSoldComps: Array.from({ length: count }, (_, index) => ({
        sourceUrl: `https://example.com/sold/${index + 1}`,
        soldAt: `2026-08-${String(index + 1).padStart(2, "0")}`,
        price: 20 + index,
        currency: "USD" as const,
        matchQuality: "exact" as const,
        condition: "carded excellent",
        packaging: "sealed",
      })),
    },
  };
}
