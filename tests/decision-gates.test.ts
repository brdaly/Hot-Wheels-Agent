import { describe, expect, it } from "vitest";
import { exactReleaseGate, marketEvidenceGrade, recommendationFor, scoreObservation, visualEvidenceGrade } from "../lib/scoring";
import { releaseFingerprint } from "../lib/release-fingerprint";
import { ferrari, withExactSoldComps } from "./fixtures";

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
    expect(marketEvidenceGrade(ferrari, new Date("2026-08-28T12:00:00Z"))).toBe("U");
  });

  it("requires five recent exact completed sales for market grade A", () => {
    expect(marketEvidenceGrade(withExactSoldComps(ferrari, 5), new Date("2026-08-28T12:00:00Z"))).toBe("A");
  });

  it("counts only same-currency comps with explicit condition and packaging comparability", () => {
    const mixed = withExactSoldComps(ferrari, 5);
    mixed.marketEvidence.exactSoldComps[0] = {
      ...mixed.marketEvidence.exactSoldComps[0],
      currency: "EUR",
    };
    mixed.marketEvidence.exactSoldComps[1] = {
      ...mixed.marketEvidence.exactSoldComps[1],
      conditionComparable: false,
    };
    mixed.marketEvidence.exactSoldComps[2] = {
      ...mixed.marketEvidence.exactSoldComps[2],
      packagingComparable: false,
    };
    expect(marketEvidenceGrade(mixed, new Date("2026-08-28T12:00:00Z"))).toBe("C");

    const noComparisonCurrency = {
      ...withExactSoldComps(ferrari, 5),
      marketEvidence: {
        ...withExactSoldComps(ferrari, 5).marketEvidence,
        comparisonCurrency: null,
      },
    };
    expect(marketEvidenceGrade(noComparisonCurrency, new Date("2026-08-28T12:00:00Z"))).toBe("U");
  });

  it("does not infer comparability from free-text condition or packaging labels", () => {
    const unreviewed = withExactSoldComps(ferrari, 5);
    unreviewed.marketEvidence.exactSoldComps = unreviewed.marketEvidence.exactSoldComps.map((comp) => ({
      ...comp,
      conditionComparable: null,
      packagingComparable: null,
    }));
    expect(marketEvidenceGrade(unreviewed, new Date("2026-08-28T12:00:00Z"))).toBe("U");
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

  it("creates a stable exact-release fingerprint and never merges a provisional ID", () => {
    expect(releaseFingerprint(ferrari.identification).status).toBe("exact");
    const provisional = { ...ferrari.identification, colorOrLivery: null, productCode: null, collectorNumber: null };
    expect(releaseFingerprint(provisional).status).toBe("provisional");
    expect(exactReleaseGate({ ...ferrari, identification: provisional }).ready).toBe(false);
  });
});
