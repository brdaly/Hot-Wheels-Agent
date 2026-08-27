import type { CarObservation, ConditionGrade, ScoreComponents } from "./analysis-schema";

export const SCORE_MODEL_VERSION = "collection-priority-v2.0";
export const MAXIMUMS = { releaseSignificance: 25, castingDesirability: 20, lineExecution: 15, cultureStory: 15, marketLiquidity: 10, personalFit: 10, riskClarity: 5 } as const satisfies Record<keyof ScoreComponents, number>;

export function totalScore(components: ScoreComponents): number {
  return (Object.keys(MAXIMUMS) as (keyof ScoreComponents)[]).reduce((total, key) => {
    const value = components[key];
    if (!Number.isInteger(value) || value < 0 || value > MAXIMUMS[key]) throw new RangeError(`${key} must be an integer from 0 to ${MAXIMUMS[key]}`);
    return total + value;
  }, 0);
}
export function tierFor(score: number) { if (score >= 95) return "S+"; if (score >= 90) return "S"; if (score >= 85) return "A+"; if (score >= 80) return "A"; if (score >= 75) return "B+"; if (score >= 55) return "B"; if (score >= 40) return "C"; return "D"; }
export function marketEvidenceGrade(o: CarObservation) {
  const n = o.evidenceObserved.length, confidence = o.identification.confidence, points = o.proposedComponents.marketLiquidity;
  if (confidence === "high" && n >= 5 && points >= 8) return "A";
  if (confidence !== "low" && n >= 3 && points >= 6) return "B";
  if (n >= 2 && points >= 3) return "C";
  return "U";
}
const conditionRank: Record<ConditionGrade, number> = { mint: 5, excellent: 4, good: 3, fair: 2, poor: 1, unknown: 0 };
export function conditionGate(grade: ConditionGrade, score: number) {
  if (grade === "unknown") return { status: "verify", label: "Inspect card and blister" } as const;
  if (conditionRank[grade] <= 1) return { status: "fail", label: score >= 90 ? "Rare enough to authenticate; condition limits value" : "Open or skip" } as const;
  if (conditionRank[grade] <= 2) return { status: "caution", label: "Condition reduces carded value" } as const;
  return { status: "pass", label: "Condition supports a carded hold" } as const;
}
export function recommendationFor(o: CarObservation, score: number) {
  const chase = o.identification.chaseStatus;
  const verifiedChase = o.identification.confidence === "high" && ["super_th", "premium_chase"].includes(chase);
  const decision = verifiedChase ? "Buy at retail" : score >= 90 ? "Priority buy" : score >= 80 ? "Buy at fair retail" : score >= 65 ? "Selective buy" : score >= 45 ? "Personal-joy only" : "Skip";
  const gate = conditionGate(o.condition.grade, score);
  const packaging = ["super_th", "premium_chase", "rlc", "convention", "error"].includes(chase) ? "Keep sealed and protect" : score >= 75 && gate.status !== "fail" ? "Keep first clean copy carded; open duplicates" : "Open/display is reasonable";
  return { decision, packaging, conditionGate: gate, rationale: [`Collection Priority Score ${score}/100 (${tierFor(score)})`, `Market Evidence Grade ${marketEvidenceGrade(o)}`, `${o.identification.confidence} exact-release confidence`] };
}
export function scoreObservation(o: CarObservation) { const total = totalScore(o.proposedComponents); return { total, tier: tierFor(total), components: o.proposedComponents, modelVersion: SCORE_MODEL_VERSION }; }
export const scoreAnalysis = scoreObservation;
