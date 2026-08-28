import { describe, expect, it } from "vitest";
import { exactReleaseGate, marketEvidenceGrade, recommendationFor, scoreObservation, visualEvidenceGrade } from "../lib/scoring";
import { releaseFingerprint } from "../lib/release-fingerprint";
import { ferrari, withExactSoldComps } from "./fixtures";

describe("separate evidence and decision gates", () => {
  it("does not mix condition into collection priority", () => {
    const poor = { ...ferrari, condition: { ...ferrari.condition, grade: "poor" as const } };
    expect(scoreObservation(poor).total).toBe(scoreObservation(ferrari).total);
    expect(recommendationFor(poor, scoreObservation(poor).total).conditionGate.status).toBe("fail");
  });

  it("does not mislabel visual observations as market evidence", () => {
    expect(visualEvidenceGrade(ferrari)).toBe("A");
    expect(marketEvidenceGrade(ferrari, new Date("2026-08-28T12:00:00Z"))).toBe("U");
  });

  it("requires five recent exact completed sales for market grade A", () => {
    expect(marketEvidenceGrade(withExactSoldComps(ferrari, 5), new Date("2026-08-28T12:00:00Z"))).toBe("A");
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
