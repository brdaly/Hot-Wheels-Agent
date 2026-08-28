const CONDITION_GRADES = new Set(["mint", "excellent", "good", "fair", "poor", "unknown"]);
const MARKET_GRADES = new Set(["A", "B", "C", "U"]);

type DeterministicRecommendation = {
  conditionGrade?: string | null;
  conditionGate: { status?: string | null; label?: string | null };
};

export function deriveResultPresentation(input: {
  recommendation: DeterministicRecommendation;
  upstreamVerify: boolean;
  otherVerificationCount: number;
  marketEvidenceCount?: number | null;
  marketEvidenceGrade?: string | null;
}) {
  const rawConditionGrade = input.recommendation.conditionGrade?.trim().toLowerCase() ?? "";
  const conditionGrade = CONDITION_GRADES.has(rawConditionGrade) ? rawConditionGrade : "unknown";
  const rawConditionStatus = input.recommendation.conditionGate.status?.trim().toLowerCase() ?? "";
  const conditionStatus = rawConditionStatus || "verify";
  const conditionAction = input.recommendation.conditionGate.label?.trim() || "Inspect card and blister condition";
  const conditionNeedsVerification = conditionGrade === "unknown" || conditionStatus === "verify" || conditionStatus === "unknown";
  const verifyFirst = input.upstreamVerify || input.otherVerificationCount > 0 || conditionNeedsVerification;
  const presentationState = verifyFirst
    ? "verify"
    : conditionStatus === "fail"
      ? "fail"
      : conditionStatus === "caution"
        ? "caution"
        : "ready";

  const marketEvidenceCount = Number.isInteger(input.marketEvidenceCount) && Number(input.marketEvidenceCount) > 0
    ? Number(input.marketEvidenceCount)
    : 0;
  const proposedMarketGrade = input.marketEvidenceGrade?.trim().toUpperCase() ?? "";
  const marketEvidenceGrade = marketEvidenceCount > 0 && MARKET_GRADES.has(proposedMarketGrade)
    ? proposedMarketGrade
    : "U";

  return {
    conditionGrade,
    conditionStatus,
    conditionAction,
    conditionNeedsVerification,
    verifyFirst,
    presentationState,
    decisionReady: presentationState === "ready",
    marketEvidenceCount,
    marketEvidenceGrade,
  } as const;
}
