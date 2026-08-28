import { describe, expect, it } from "vitest";
import {
  comparableExactCompCount,
  exactReleaseGate,
  marketEvidenceGrade,
  recommendationFor,
  scoreObservation,
  visualEvidenceGrade,
  type VerifiedMarketEvidence,
} from "../lib/scoring";
import { canonicalReleaseFingerprintToken, releaseFingerprint } from "../lib/release-fingerprint";
import { ferrari, withExactSoldComps } from "./fixtures";

const NOW = new Date("2026-08-28T12:00:00Z");

function verifiedEvidence(count = 5): VerifiedMarketEvidence {
  const observation = withExactSoldComps(ferrari, count);
  return {
    comps: observation.marketEvidence.exactSoldComps.map((comp) => ({
      ...comp,
      provider: "licensed-sales-adapter",
      providerVerified: true,
    })),
    releaseFingerprint: releaseFingerprint(observation.identification).key,
    targetCurrency: "USD",
    targetPackaging: "sealed",
    targetCondition: "carded excellent",
  };
}

describe("separate evidence and decision gates", () => {
  it("does not mix condition into collection priority", () => {
    const legacyPoor = { ...ferrari, condition: { ...ferrari.condition, grade: "poor" as const } };
    expect(scoreObservation(legacyPoor).total).toBe(scoreObservation(ferrari).total);
    expect(recommendationFor(legacyPoor, scoreObservation(legacyPoor).total).conditionGate.status).toBe("verify");

    const observedCrack = {
      ...legacyPoor,
      condition: {
        ...legacyPoor.condition,
        cues: {
          cardCrease: null,
          cardCornerDamage: null,
          jHookDamage: null,
          blisterCrack: {
            state: "observed" as const,
            evidence: "A split is visible on the lower blister edge",
            cropSource: "blister_detail" as const,
          },
          blisterDent: null,
          blisterLift: null,
          possibleResealIndicators: null,
        },
      },
    };
    expect(scoreObservation(observedCrack).total).toBe(scoreObservation(ferrari).total);
    expect(recommendationFor(observedCrack, scoreObservation(observedCrack).total).conditionGate.status).toBe("fail");
  });

  it("does not mislabel visual observations as market evidence", () => {
    expect(visualEvidenceGrade(ferrari)).toBe("A");
    expect(marketEvidenceGrade(ferrari, NOW)).toBe("U");
  });

  it("rejects caller-supplied comps without verified provider provenance", () => {
    const observation = withExactSoldComps(ferrari, 5);
    expect(comparableExactCompCount(observation, NOW)).toBe(0);
    expect(marketEvidenceGrade(observation, NOW)).toBe("U");
    expect(scoreObservation(observation, NOW).components.marketLiquidity).toBe(0);
  });

  it("uses five verified matching comps for count, grade, and liquidity", () => {
    const observation = withExactSoldComps(ferrari, 5);
    const evidence = verifiedEvidence(5);
    expect(comparableExactCompCount(observation, NOW, evidence)).toBe(5);
    expect(marketEvidenceGrade(observation, NOW, evidence)).toBe("A");
    expect(scoreObservation(observation, NOW, evidence).components.marketLiquidity).toBe(8);
  });

  it("rejects verified comps bound to a different exact release", () => {
    const observation = withExactSoldComps(ferrari, 5);
    const differentRelease = releaseFingerprint({
      ...ferrari.identification,
      productCode: "OTHER01",
      collectorNumber: null,
    });
    const evidence = {
      ...verifiedEvidence(5),
      releaseFingerprint: differentRelease.key,
    };
    expect(differentRelease.status).toBe("exact");
    expect(comparableExactCompCount(observation, NOW, evidence)).toBe(0);
    expect(marketEvidenceGrade(observation, NOW, evidence)).toBe("U");
    expect(scoreObservation(observation, NOW, evidence).components.marketLiquidity).toBe(0);
  });

  it("counts a provider sale only once when duplicate rows share its source URL", () => {
    const observation = withExactSoldComps(ferrari, 5);
    const evidence = verifiedEvidence(5);
    const duplicateRows = {
      ...evidence,
      comps: evidence.comps.map((comp) => ({
        ...comp,
        sourceUrl: evidence.comps[0].sourceUrl,
      })),
    };
    expect(comparableExactCompCount(observation, NOW, duplicateRows)).toBe(1);
    expect(marketEvidenceGrade(observation, NOW, duplicateRows)).toBe("C");
    expect(scoreObservation(observation, NOW, duplicateRows).components.marketLiquidity).toBe(3);
  });

  it("does not infer comparability from matching free-text labels", () => {
    const observation = withExactSoldComps(ferrari, 5);
    const evidence = verifiedEvidence(5);
    const unreviewedEvidence = {
      ...evidence,
      comps: evidence.comps.map((comp) => ({
        ...comp,
        conditionComparable: null,
        packagingComparable: null,
      })),
    } as unknown as VerifiedMarketEvidence;
    expect(comparableExactCompCount(observation, NOW, unreviewedEvidence)).toBe(0);
    expect(marketEvidenceGrade(observation, NOW, unreviewedEvidence)).toBe("U");
    expect(scoreObservation(observation, NOW, unreviewedEvidence).components.marketLiquidity).toBe(0);
  });

  it("deduplicates a sale even when only one row carries the provider sale ID", () => {
    const observation = withExactSoldComps(ferrari, 2);
    const evidence = verifiedEvidence(2);
    const mixedIdentifiers = {
      ...evidence,
      comps: [
        { ...evidence.comps[0], providerSaleId: "sale-001" },
        { ...evidence.comps[1], sourceUrl: evidence.comps[0].sourceUrl },
      ],
    };
    expect(comparableExactCompCount(observation, NOW, mixedIdentifiers)).toBe(1);
  });

  it("excludes unverified, mismatched, non-exact, stale, and future comps", () => {
    const observation = withExactSoldComps(ferrari, 12);
    const evidence = verifiedEvidence(12);
    const comps = evidence.comps.map((comp, index) => {
      if (index === 0) return { ...comp, currency: "EUR" as const };
      if (index === 1) return { ...comp, packaging: "loose" };
      if (index === 2) return { ...comp, condition: "carded fair" };
      if (index === 3) return { ...comp, providerVerified: false };
      if (index === 4) return { ...comp, soldAt: "2025-01-01" };
      if (index === 5) return { ...comp, soldAt: "2026-08-29" };
      if (index === 6) return { ...comp, matchQuality: "near" as const };
      return comp;
    });
    const adversarialEvidence = { ...evidence, comps } as unknown as VerifiedMarketEvidence;
    expect(comparableExactCompCount(observation, NOW, adversarialEvidence)).toBe(5);
    expect(marketEvidenceGrade(observation, NOW, adversarialEvidence)).toBe("A");
  });

  it("hard-gates a low-confidence identity regardless of score", () => {
    const uncertain = {
      ...ferrari,
      identification: { ...ferrari.identification, confidence: "low" as const, productCode: null },
      verificationNeeded: ["Verify product code"],
    };
    const recommendation = recommendationFor(uncertain, 99);
    expect(recommendation.decision).toBe("Verify first");
    expect(recommendation.verifyFirst).toBe(true);
  });

  it("treats an unsupported duplicate as a pass", () => {
    const recommendation = recommendationFor(ferrari, scoreObservation(ferrari).total, { ownedQuantity: 1, copyIntent: "unspecified" });
    expect(recommendation.decision).toBe("Pass on duplicate");
  });

  it("uses verified market evidence consistently for duplicate guidance", () => {
    const evidence = verifiedEvidence(5);
    const score = scoreObservation(ferrari, NOW, evidence);
    const recommendation = recommendationFor(
      ferrari,
      score.total,
      { ownedQuantity: 1, copyIntent: "unspecified" },
      NOW,
      evidence,
    );
    expect(recommendation.decision).toBe("Duplicate—verify purpose");
    expect(recommendation.rationale).toContain("Market Evidence Grade A");
  });

  it("creates a stable exact-release fingerprint and never merges a provisional ID", () => {
    expect(releaseFingerprint(ferrari.identification).status).toBe("exact");
    const provisional = { ...ferrari.identification, colorOrLivery: null, productCode: null, collectorNumber: null };
    expect(releaseFingerprint(provisional)).toMatchObject({ status: "provisional", aliases: [] });
    expect(exactReleaseGate({ ...ferrari, identification: provisional }).ready).toBe(false);
  });

  it("provides equivalent aliases when both release identifiers are known", () => {
    const both = releaseFingerprint(ferrari.identification);
    const productOnly = releaseFingerprint({ ...ferrari.identification, collectorNumber: null });
    const collectorOnly = releaseFingerprint({ ...ferrari.identification, productCode: null });
    expect(both.aliases).toContain(productOnly.key);
    expect(both.aliases).toContain(collectorOnly.key);
    expect(productOnly.core).toBe(both.core);
    expect(collectorOnly.core).toBe(both.core);
  });

  it("normalizes Unicode compatibility characters in release identity", () => {
    const compatibilityText = releaseFingerprint({
      ...ferrari.identification,
      casting: "\uFF26\uFF45\uFF52\uFF52\uFF41\uFF52\uFF49 Testarossa",
    });
    expect(compatibilityText.key).toBe(releaseFingerprint(ferrari.identification).key);
  });

  it.each([
    ["\uFF26\uFF14\uFF10", "f40"],
    ["\u00A0US\u00A0", "us"],
    ["’87 Buick Regal GNX", "87-buick-regal-gnx"],
    ["Cafe\u0301", "caf"],
    ["I", "i"],
    ["   ", "unknown"],
  ])("uses the shared canonical token contract for %j", (value, expected) => {
    expect(canonicalReleaseFingerprintToken(value)).toBe(expected);
  });

  it.each([
    ["canonical-empty product code", { productCode: "\u00A0", collectorNumber: null }],
    ["punctuation-only tooling", { tooling: "!!!" }],
    ["literal unknown region", { region: "unknown" }],
    ["a different brand", { brand: "Matchbox" }],
  ])("keeps %s provisional", (_label, overrides) => {
    expect(releaseFingerprint({ ...ferrari.identification, ...overrides })).toMatchObject({
      status: "provisional",
      aliases: [],
    });
  });
});
