import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import { CarObservationSchema, PhotoAnalysisSchema } from "../lib/analysis-schema";
import {
  deterministicConditionGrade,
  exactReleaseGate,
  recommendationFor,
  scoreObservation,
} from "../lib/scoring";
import { ferrari } from "./fixtures";

const absentCue = {
  state: "absent" as const,
  evidence: "The dedicated detail does not show this condition indicator",
  cropSource: "blister_detail" as const,
};

const cleanCues = {
  cardCrease: { ...absentCue, cropSource: "full_card_front" as const },
  cardCornerDamage: { ...absentCue, cropSource: "card_corner_detail" as const },
  jHookDamage: { ...absentCue, cropSource: "j_hook_detail" as const },
  blisterCrack: absentCue,
  blisterDent: absentCue,
  blisterLift: absentCue,
  possibleResealIndicators: absentCue,
};

describe("photo analysis contract v3.1", () => {
  it("remains compatible with strict provider structured output", () => {
    expect(() => zodTextFormat(PhotoAnalysisSchema, "hot_wheels_photo_analysis")).not.toThrow();
  });

  it("accepts existing observations that predate structured condition and base-code fields", () => {
    expect(CarObservationSchema.parse(ferrari)).toEqual(ferrari);
    expect(deterministicConditionGrade(ferrari.condition)).toBe("unknown");
    expect(deterministicConditionGrade(ferrari.condition, { allowLegacyStoredGrade: true })).toBe("excellent");
  });

  it("derives the final condition grade from complete visible cues", () => {
    const condition = { ...ferrari.condition, grade: "poor" as const, cues: cleanCues };
    expect(deterministicConditionGrade(condition)).toBe("excellent");

    const blisterCrack = {
      ...condition,
      cues: {
        ...cleanCues,
        blisterCrack: {
          state: "observed" as const,
          evidence: "A split is visible along the lower blister edge",
          cropSource: "blister_detail" as const,
        },
      },
    };
    expect(deterministicConditionGrade(blisterCrack)).toBe("poor");
  });

  it("preserves a supported severe-damage finding when another cue is unclear or unassessed", () => {
    const mixed = {
      ...ferrari.condition,
      cues: {
        ...cleanCues,
        cardCornerDamage: null,
        jHookDamage: {
          state: "unclear" as const,
          evidence: "The J-hook is partly outside the image",
          cropSource: "full_card_front" as const,
        },
        blisterLift: {
          state: "observed" as const,
          evidence: "The blister is visibly separated along the lower edge",
          cropSource: "blister_detail" as const,
        },
      },
    };
    expect(deterministicConditionGrade(mixed)).toBe("poor");
  });

  it("routes possible reseal indicators to manual inspection without alleging misconduct", () => {
    const observation = {
      ...ferrari,
      condition: {
        ...ferrari.condition,
        cues: {
          ...cleanCues,
          possibleResealIndicators: {
            state: "observed" as const,
            evidence: "Uneven adhesive is visible near one blister edge",
            cropSource: "blister_detail" as const,
          },
        },
      },
    };
    const recommendation = recommendationFor(observation, scoreObservation(observation).total);
    expect(recommendation.conditionGrade).toBe("unknown");
    expect(recommendation.conditionGate).toEqual({
      status: "verify",
      label: "Possible lift or reseal indicators need manual inspection",
    });
    expect(recommendation.conditionGate.label).not.toMatch(/fraud|tamper/i);
  });

  it("fails an unresolved base-code OCR observation closed", () => {
    const uncertain = CarObservationSchema.parse({
      ...ferrari,
      baseCodeObservation: {
        state: "observed",
        rawText: "R2?",
        normalizedText: null,
        confidence: "medium",
        cropSource: "full_vehicle",
        evidence: "Three possible characters are visible through the blister",
      },
    });
    const gate = exactReleaseGate(uncertain);
    expect(gate.ready).toBe(false);
    expect(gate.reasons.join(" ")).toMatch(/base-code/i);
    expect(recommendationFor(uncertain, 99).decision).toBe("Verify first");
  });

  it("accepts a high-confidence dedicated base crop as supporting evidence, not an identity substitute", () => {
    const supported = CarObservationSchema.parse({
      ...ferrari,
      baseCodeObservation: {
        state: "observed",
        rawText: "R22",
        normalizedText: "R22",
        confidence: "high",
        cropSource: "vehicle_base_detail",
        evidence: "R22 is legible on the vehicle base",
      },
    });
    expect(exactReleaseGate(supported).ready).toBe(true);

    const missingReleaseFields = {
      ...supported,
      identification: {
        ...supported.identification,
        productCode: null,
        collectorNumber: null,
      },
    };
    expect(exactReleaseGate(missingReleaseFields).ready).toBe(false);
  });

  it("rejects a contradictory absent base-code observation", () => {
    const inconsistent = CarObservationSchema.parse({
      ...ferrari,
      baseCodeObservation: {
        state: "absent",
        rawText: "R22",
        normalizedText: "R22",
        confidence: "high",
        cropSource: "vehicle_base_detail",
        evidence: "The base was inspected",
      },
    });
    expect(exactReleaseGate(inconsistent).reasons).toContain("Base-code observation is internally inconsistent");
  });

  it("requires evidence and dedicated-view provenance for base-code assertions", () => {
    const observedWithoutEvidence = CarObservationSchema.parse({
      ...ferrari,
      baseCodeObservation: {
        state: "observed",
        rawText: "R22",
        normalizedText: "R22",
        confidence: "high",
        cropSource: "vehicle_base_detail",
        evidence: null,
      },
    });
    expect(exactReleaseGate(observedWithoutEvidence).reasons).toContain("Base-code OCR needs visible evidence provenance");

    const absentWithoutDedicatedView = CarObservationSchema.parse({
      ...ferrari,
      baseCodeObservation: {
        state: "absent",
        rawText: null,
        normalizedText: null,
        confidence: "high",
        cropSource: "full_vehicle",
        evidence: "No code can be seen through the package",
      },
    });
    expect(exactReleaseGate(absentWithoutDedicatedView).reasons).toContain("An asserted base-code absence needs a dedicated vehicle-base detail image");
  });
});
