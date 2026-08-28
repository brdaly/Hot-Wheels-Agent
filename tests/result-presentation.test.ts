import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveResultPresentation } from "../lib/result-presentation";
import {
  comparableExactCompCount,
  marketEvidenceGrade,
  recommendationFor,
  scoreObservation,
} from "../lib/scoring";
import { ferrari, withExactSoldComps } from "./fixtures";

describe("authoritative result presentation", () => {
  it("displays deterministic unknown/verify when the model hint says excellent but cues are missing", () => {
    expect(ferrari.condition.grade).toBe("excellent");
    const recommendation = recommendationFor(ferrari, scoreObservation(ferrari).total);
    const presentation = deriveResultPresentation({
      recommendation,
      upstreamVerify: false,
      otherVerificationCount: 0,
      marketEvidenceCount: 0,
      marketEvidenceGrade: "U",
    });

    expect(recommendation.conditionGrade).toBe("unknown");
    expect(recommendation.conditionGate.status).toBe("verify");
    expect(presentation).toMatchObject({
      conditionGrade: "unknown",
      conditionStatus: "verify",
      verifyFirst: true,
      presentationState: "verify",
      decisionReady: false,
    });
  });

  it.each([
    ["fail", "poor", "Open or skip"],
    ["caution", "fair", "Condition reduces carded value"],
  ])("keeps a %s condition gate out of the passing decision-ready state", (status, grade, label) => {
    const presentation = deriveResultPresentation({
      recommendation: { conditionGrade: grade, conditionGate: { status, label } },
      upstreamVerify: false,
      otherVerificationCount: 0,
      marketEvidenceCount: 0,
      marketEvidenceGrade: "U",
    });
    expect(presentation.presentationState).toBe(status);
    expect(presentation.conditionAction).toBe(label);
    expect(presentation.decisionReady).toBe(false);
  });

  it("uses the backend comparable-comp count rather than the raw submitted array length", () => {
    const observation = withExactSoldComps(ferrari, 5);
    observation.marketEvidence.exactSoldComps[0] = {
      ...observation.marketEvidence.exactSoldComps[0],
      conditionComparable: false,
    };
    observation.marketEvidence.exactSoldComps[1] = {
      ...observation.marketEvidence.exactSoldComps[1],
      currency: "EUR",
    };
    const count = comparableExactCompCount(observation, new Date("2026-08-28T12:00:00Z"));
    const grade = marketEvidenceGrade(observation, new Date("2026-08-28T12:00:00Z"));
    const presentation = deriveResultPresentation({
      recommendation: recommendationFor(observation, scoreObservation(observation).total),
      upstreamVerify: false,
      otherVerificationCount: 0,
      marketEvidenceCount: count,
      marketEvidenceGrade: grade,
    });

    expect(observation.marketEvidence.exactSoldComps).toHaveLength(5);
    expect(presentation.marketEvidenceCount).toBe(3);
    expect(presentation.marketEvidenceGrade).toBe("B");
  });

  it("keeps the result card wired to deterministic presentation fields", () => {
    const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("deriveResultPresentation");
    expect(source).not.toContain("car.condition.grade");
    expect(source).toContain("presentation.conditionNeedsVerification");
    expect(source).toContain("car.marketEvidenceCount");
  });
});
