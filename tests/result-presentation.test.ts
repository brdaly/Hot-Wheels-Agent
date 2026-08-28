import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveResultPresentation } from "../lib/result-presentation";
import {
  comparableExactCompCount,
  marketEvidenceGrade,
  recommendationFor,
  scoreObservation,
  type VerifiedMarketEvidence,
} from "../lib/scoring";
import { releaseFingerprint } from "../lib/release-fingerprint";
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

  it("fails closed when only raw submitted comps are available", () => {
    const observation = withExactSoldComps(ferrari, 5);
    const count = comparableExactCompCount(observation, NOW);
    const grade = marketEvidenceGrade(observation, NOW);
    const presentation = deriveResultPresentation({
      recommendation: recommendationFor(observation, scoreObservation(observation).total),
      upstreamVerify: false,
      otherVerificationCount: 0,
      marketEvidenceCount: count,
      marketEvidenceGrade: grade,
    });

    expect(observation.marketEvidence.exactSoldComps).toHaveLength(5);
    expect(presentation.marketEvidenceCount).toBe(0);
    expect(presentation.marketEvidenceGrade).toBe("U");
  });

  it("presents the verified backend count rather than the raw array length", () => {
    const observation = withExactSoldComps(ferrari, 5);
    const evidence = verifiedEvidence(5);
    const count = comparableExactCompCount(observation, NOW, evidence);
    const grade = marketEvidenceGrade(observation, NOW, evidence);
    const score = scoreObservation(observation, NOW, evidence);
    const presentation = deriveResultPresentation({
      recommendation: recommendationFor(observation, score.total, {}, NOW, evidence),
      upstreamVerify: false,
      otherVerificationCount: 0,
      marketEvidenceCount: count,
      marketEvidenceGrade: grade,
    });

    expect(presentation.marketEvidenceCount).toBe(5);
    expect(presentation.marketEvidenceGrade).toBe("A");
  });

  it("keeps the result card wired to deterministic presentation fields", () => {
    const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(source).toContain("deriveResultPresentation");
    expect(source).not.toContain("car.condition.grade");
    expect(source).toContain("presentation.conditionNeedsVerification");
    expect(source).toContain("car.marketEvidenceCount");
  });
});
