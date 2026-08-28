import type {
  CarObservation,
  ConditionGrade,
  ConditionObservation,
  CopyIntent,
  ScoreComponents,
} from "./analysis-schema";
import { findChaseReference } from "./collector-reference";
import { releaseFingerprint } from "./release-fingerprint";

export const SCORE_MODEL_VERSION = "collection-priority-v3.1";
export const MARKET_EVIDENCE_WINDOW_DAYS = 180;
export const MAXIMUMS = {
  releaseSignificance: 25,
  castingDesirability: 20,
  lineExecution: 15,
  cultureStory: 15,
  marketLiquidity: 10,
  personalFit: 10,
  riskClarity: 5,
} as const satisfies Record<keyof ScoreComponents, number>;

export function totalScore(components: ScoreComponents): number {
  return (Object.keys(MAXIMUMS) as (keyof ScoreComponents)[]).reduce((total, key) => {
    const value = components[key];
    if (!Number.isInteger(value) || value < 0 || value > MAXIMUMS[key]) {
      throw new RangeError(`${key} must be an integer from 0 to ${MAXIMUMS[key]}`);
    }
    return total + value;
  }, 0);
}

export function tierFor(score: number) {
  if (score >= 95) return "S+";
  if (score >= 90) return "S";
  if (score >= 85) return "A+";
  if (score >= 80) return "A";
  if (score >= 75) return "B+";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function comparableExactCompCount(observation: CarObservation, now = new Date()) {
  const comparisonCurrency = observation.marketEvidence.comparisonCurrency;
  if (!comparisonCurrency) return 0;
  const cutoff = now.getTime() - MARKET_EVIDENCE_WINDOW_DAYS * 86_400_000;
  return observation.marketEvidence.exactSoldComps.filter((comp) => {
    const soldAt = Date.parse(`${comp.soldAt}T00:00:00Z`);
    return comp.matchQuality === "exact" &&
      comp.currency === comparisonCurrency &&
      comp.conditionComparable === true &&
      comp.packagingComparable === true &&
      Number.isFinite(soldAt) &&
      soldAt >= cutoff &&
      soldAt <= now.getTime();
  }).length;
}

export function marketEvidenceGrade(observation: CarObservation, now = new Date()) {
  const count = comparableExactCompCount(observation, now);
  if (count >= 5) return "A";
  if (count >= 3) return "B";
  if (count >= 1) return "C";
  return "U";
}

export function visualEvidenceGrade(observation: CarObservation) {
  const count = observation.evidenceObserved.length;
  if (observation.identification.confidence === "high" && count >= 6) return "A";
  if (observation.identification.confidence !== "low" && count >= 4) return "B";
  if (count >= 2) return "C";
  return "U";
}

export function chaseVerification(observation: CarObservation, now = new Date()) {
  const { chaseStatus, chaseMarkersObserved, confidence } = observation.identification;
  const markers = new Set(chaseMarkersObserved);
  const reference = findChaseReference(observation.identification, now);
  if (chaseStatus === "none" || chaseStatus === "unknown") {
    return { verified: chaseStatus === "none", reason: chaseStatus === "none" ? "No chase claim" : "Chase state is unresolved", reference };
  }
  if (confidence !== "high") return { verified: false, reason: "Exact-release confidence is not high", reference };
  if (chaseStatus === "regular_th") {
    const visible = markers.has("low_production_vehicle_symbol");
    const sourced = reference.match === "exact_product_code";
    return { verified: visible && sourced, reason: visible && sourced ? "Visible vehicle low-production symbol and exact product-code reference" : "Regular TH needs the low-production symbol on the vehicle and an exact product-code match", reference };
  }
  if (chaseStatus === "super_th") {
    const visible = markers.has("th_body_tampo") && markers.has("spectraflame_paint") && markers.has("real_riders");
    const sourced = reference.match === "exact_product_code";
    return { verified: visible && sourced, reason: visible && sourced ? "Visible TH tampo, Spectraflame, Real Riders and exact product-code reference" : "Super TH needs TH tampo, Spectraflame, Real Riders and an exact product-code match", reference };
  }
  if (chaseStatus === "premium_chase") {
    const visible = markers.has("zero_of_set") && markers.has("premium_chase_colorway");
    return { verified: false, reason: visible ? "Visible 0/set numbering and chase colorway still need an exact current source cross-check" : "Premium chase needs visible 0/set numbering, the chase colorway, and an exact current source cross-check", reference };
  }
  if (chaseStatus === "rlc") {
    const visible = markers.has("rlc_branding_or_numbering") && Boolean(observation.identification.productCode);
    return { verified: false, reason: visible ? "Visible RLC evidence and product code still need an official release cross-check" : "RLC status needs visible branding or numbering, a product code, and an official release cross-check", reference };
  }
  if (chaseStatus === "convention") {
    const visible = markers.has("convention_branding") && Boolean(observation.identification.productCode);
    return { verified: false, reason: visible ? "Visible convention evidence and product code still need an official event cross-check" : "Convention status needs visible branding, a product code, and an official event cross-check", reference };
  }
  return { verified: false, reason: "An error claim needs comparison with the normal exact release and human review", reference };
}

function criticalVerificationItems(observation: CarObservation) {
  return observation.verificationNeeded.filter((item) =>
    /(identity|casting|year|line|series|mix|product code|collector number|color|livery|chase|wheel|card type|base code)/i.test(item)
  );
}

export function baseCodeVerificationReasons(observation: CarObservation) {
  const baseCode = observation.baseCodeObservation;
  if (!baseCode) return [];
  if (baseCode.state === "absent") {
    const reasons: string[] = [];
    if (baseCode.rawText || baseCode.normalizedText) reasons.push("Base-code observation is internally inconsistent");
    if (baseCode.cropSource !== "vehicle_base_detail") reasons.push("An asserted base-code absence needs a dedicated vehicle-base detail image");
    if (!baseCode.evidence) reasons.push("An asserted base-code absence needs visible evidence provenance");
    if (baseCode.confidence !== "high") reasons.push("An asserted base-code absence must be high confidence");
    return reasons;
  }
  if (baseCode.state === "unclear") return ["Base-code characters are unclear"];

  const reasons: string[] = [];
  if (!baseCode.rawText || !baseCode.normalizedText) reasons.push("Base-code OCR needs a resolved raw and normalized reading");
  if (!baseCode.evidence) reasons.push("Base-code OCR needs visible evidence provenance");
  if (baseCode.confidence !== "high") reasons.push("Base-code OCR confidence must be high before it supports an exact-release decision");
  if (baseCode.cropSource !== "vehicle_base_detail") reasons.push("Base-code OCR needs a dedicated vehicle-base detail image");
  return reasons;
}

export function exactReleaseGate(observation: CarObservation, now = new Date()) {
  const fingerprint = releaseFingerprint(observation.identification);
  const chase = chaseVerification(observation, now);
  const critical = criticalVerificationItems(observation);
  const baseCodeReasons = baseCodeVerificationReasons(observation);
  const reasons: string[] = [];
  if (observation.identification.confidence !== "high") reasons.push("Exact-release confidence must be high");
  if (fingerprint.status !== "exact") reasons.push(`Missing exact-release fields: ${fingerprint.missing.join(", ")}`);
  if (critical.length) reasons.push(...critical);
  if (baseCodeReasons.length) reasons.push(...baseCodeReasons);
  if (!chase.verified && observation.identification.chaseStatus !== "none") reasons.push(chase.reason);
  return { ready: reasons.length === 0, reasons: [...new Set(reasons)], fingerprint, chase };
}

const conditionRank: Record<ConditionGrade, number> = {
  mint: 5,
  excellent: 4,
  good: 3,
  fair: 2,
  poor: 1,
  unknown: 0,
};

/**
 * Live observations are graded only from bounded visible cues. Historical
 * callers may opt into a stored legacy grade explicitly while migrating old
 * records; photographs can never deterministically produce "mint".
 */
export function deterministicConditionGrade(
  condition: ConditionObservation,
  options: { allowLegacyStoredGrade?: boolean } = {},
): ConditionGrade {
  const cues = condition.cues;
  if (!cues) return options.allowLegacyStoredGrade ? condition.grade : "unknown";

  const entries = Object.values(cues);
  const supportedObservation = (cue: (typeof entries)[number]) =>
    cue?.state === "observed" && Boolean(cue.cropSource && cue.evidence);

  // Confirmed severe damage remains a known lower bound even if another view
  // is missing or unclear; uncertainty must not erase a visible crack/lift.
  if (supportedObservation(cues.blisterCrack) || supportedObservation(cues.blisterLift)) return "poor";
  if (entries.some((cue) => cue?.state === "observed" && !supportedObservation(cue))) return "unknown";
  if (supportedObservation(cues.possibleResealIndicators)) return "unknown";
  if (entries.some((cue) => cue === null || cue.state === "unclear")) return "unknown";
  if (entries.some((cue) => cue !== null && (!cue.cropSource || !cue.evidence))) return "unknown";
  if (cues.cardCrease?.state === "observed" || cues.blisterDent?.state === "observed") return "fair";
  if (cues.cardCornerDamage?.state === "observed" || cues.jHookDamage?.state === "observed") return "good";
  return "excellent";
}

export function conditionGate(grade: ConditionGrade, score: number) {
  if (grade === "unknown") return { status: "verify", label: "Inspect card and blister" } as const;
  if (conditionRank[grade] <= 1) return { status: "fail", label: score >= 90 ? "Rare enough to authenticate; condition limits value" : "Open or skip" } as const;
  if (conditionRank[grade] <= 2) return { status: "caution", label: "Condition reduces carded value" } as const;
  return { status: "pass", label: "Condition supports a carded hold" } as const;
}

function deriveComponents(observation: CarObservation, now = new Date()) {
  const features = observation.decisionFeatures;
  const chase = chaseVerification(observation, now);
  const fingerprint = releaseFingerprint(observation.identification);
  const coreLanes = new Set(["ferrari", "jdm_nissan", "jdm_other", "porsche", "lamborghini"]);
  const secondaryLanes = new Set(["muscle", "motorsport", "rally"]);

  const releaseBase = { mainline: 5, silver: 8, premium: 12, ultra_premium: 18, collector_edition: 16, verified_limited: 20, unknown: 0 }[features.releaseClass];
  const chasePoints = chase.verified
    ? ({ regular_th: 17, super_th: 25, premium_chase: 24, rlc: 22, convention: 22 } as Record<string, number>)[observation.identification.chaseStatus] ?? 0
    : 0;
  const releaseSignificance = Math.max(releaseBase, chasePoints);

  const casting = new Set(features.castingSignals);
  let castingDesirability = casting.has("fantasy_casting") ? 5 : casting.has("licensed_vehicle") ? 8 : 0;
  if (casting.has("new_model")) castingDesirability += 4;
  if (casting.has("motorsport_subject")) castingDesirability += 4;
  if (casting.has("historically_significant_model")) castingDesirability += 4;
  if (casting.has("collaboration")) castingDesirability += 2;
  castingDesirability = Math.min(20, castingDesirability);

  const executionWeights: Record<string, number> = {
    metal_body: 2, metal_chassis: 2, real_riders: 4, spectraflame: 4,
    opening_feature: 2, detailed_livery: 1, premium_card: 1, display_case: 2,
  };
  const lineExecution = Math.min(15, [...new Set(features.executionSignals)].reduce((total, item) => total + executionWeights[item], 0));

  const lanes = new Set(features.cultureLanes);
  const coreCount = [...lanes].filter((lane) => coreLanes.has(lane)).length;
  const secondaryCount = [...lanes].filter((lane) => secondaryLanes.has(lane)).length;
  const cultureStory = Math.min(15, coreCount ? 13 + Math.min(2, coreCount - 1) : secondaryCount ? 10 + Math.min(3, secondaryCount - 1) : lanes.has("other") ? 4 : 0);
  const personalFit = coreCount ? 10 : secondaryCount ? 8 : lanes.has("other") ? 3 : 0;

  const compCount = comparableExactCompCount(observation, now);
  const marketLiquidity = compCount >= 8 ? 10 : compCount >= 5 ? 8 : compCount >= 3 ? 6 : compCount >= 1 ? 3 : 0;
  const critical = criticalVerificationItems(observation);
  const baseCodeReasons = baseCodeVerificationReasons(observation);
  const riskClarity = observation.identification.confidence === "high" && fingerprint.status === "exact" && critical.length === 0 && baseCodeReasons.length === 0
    ? 5
    : observation.identification.confidence === "medium" ? 3 : 1;

  const components: ScoreComponents = {
    releaseSignificance, castingDesirability, lineExecution, cultureStory,
    marketLiquidity, personalFit, riskClarity,
  };
  const componentReasons: Record<keyof ScoreComponents, string> = {
    releaseSignificance: chasePoints ? chase.reason : `Release class: ${features.releaseClass}`,
    castingDesirability: features.castingSignals.length ? `Signals: ${features.castingSignals.join(", ")}` : "No supported casting signals",
    lineExecution: features.executionSignals.length ? `Visible execution: ${features.executionSignals.join(", ")}` : "No supported execution features",
    cultureStory: features.cultureLanes.length ? `Collector lanes: ${features.cultureLanes.join(", ")}` : "No supported culture lane",
    marketLiquidity: compCount ? `${compCount} recent exact completed-sale comp${compCount === 1 ? "" : "s"}` : "No recent exact completed-sale comps",
    personalFit: features.cultureLanes.length ? "Mapped to Brendan's declared collection lanes" : "No supported personal-fit lane",
    riskClarity: baseCodeReasons.length
      ? `Base-code verification required: ${baseCodeReasons.join("; ")}`
      : fingerprint.status === "exact" ? `${observation.identification.confidence} identity confidence` : `Provisional fingerprint; missing ${fingerprint.missing.join(", ")}`,
  };
  return { components, componentReasons };
}

export function scoreObservation(observation: CarObservation, now = new Date()) {
  const { components, componentReasons } = deriveComponents(observation, now);
  const total = totalScore(components);
  return { total, tier: tierFor(total), components, componentReasons, modelVersion: SCORE_MODEL_VERSION };
}

export function recommendationFor(
  observation: CarObservation,
  score: number,
  context: { ownedQuantity?: number; copyIntent?: CopyIntent } = {},
  now = new Date(),
) {
  const exact = exactReleaseGate(observation, now);
  const marketGrade = marketEvidenceGrade(observation, now);
  const ownedQuantity = Math.max(0, context.ownedQuantity ?? 0);
  const copyIntent = context.copyIntent ?? "unspecified";
  let decision: string;
  if (!exact.ready) {
    decision = "Verify first";
  } else if (ownedQuantity > 0 && copyIntent === "unspecified") {
    decision = marketGrade === "A" || marketGrade === "B" ? "Duplicate—verify purpose" : "Pass on duplicate";
  } else if (ownedQuantity > 0) {
    decision = score >= 75 ? "Purposeful duplicate" : "Skip duplicate";
  } else if (exact.chase.verified && ["super_th", "premium_chase"].includes(observation.identification.chaseStatus)) {
    decision = "Buy at fair retail";
  } else if (score >= 85) {
    decision = "High-priority candidate";
  } else if (score >= 75) {
    decision = "Buy at fair retail";
  } else if (score >= 60) {
    decision = "Selective buy";
  } else if (score >= 45) {
    decision = "Personal-joy only";
  } else {
    decision = "Skip";
  }
  const conditionGrade = deterministicConditionGrade(observation.condition);
  const possibleResealNeedsReview = observation.condition.cues?.possibleResealIndicators?.state === "observed";
  const gate = possibleResealNeedsReview
    ? conditionGrade === "poor"
      ? { status: "fail", label: "Severe package damage is visible; possible lift or reseal indicators also need manual inspection" } as const
      : { status: "verify", label: "Possible lift or reseal indicators need manual inspection" } as const
    : conditionGate(conditionGrade, score);
  const chase = observation.identification.chaseStatus;
  const packaging = ["super_th", "premium_chase", "rlc", "convention", "error"].includes(chase)
    ? "Keep sealed and protect"
    : score >= 75 && gate.status !== "fail" ? "Keep first clean copy carded; open purposeful duplicates" : "Open/display is reasonable";
  return {
    decision,
    packaging,
    conditionGrade,
    conditionGate: gate,
    verifyFirst: !exact.ready,
    verificationReasons: exact.reasons,
    collectionContext: { ownedQuantity, copyIntent, isDuplicate: ownedQuantity > 0 },
    rationale: [
      `Collection Priority Score ${score}/100 (${tierFor(score)})`,
      `Visual Evidence Grade ${visualEvidenceGrade(observation)}`,
      `Market Evidence Grade ${marketGrade}`,
      `${observation.identification.confidence} exact-release confidence`,
    ],
  };
}

export const scoreAnalysis = scoreObservation;
