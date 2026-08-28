import { z } from "zod";

const shortText = z.string().trim().min(1).max(120);
const optionalShortText = z.string().trim().min(1).max(120).nullable();
const evidenceText = z.string().trim().min(1).max(240);

export const ANALYSIS_CONTRACT_VERSION = "photo-analysis-v3.0";

export const ChaseStatusSchema = z.enum([
  "none",
  "regular_th",
  "super_th",
  "premium_chase",
  "rlc",
  "convention",
  "error",
  "unknown",
]);

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const ProductCategorySchema = z.enum([
  "mainline_single",
  "five_pack",
  "silver_series",
  "premium_single",
  "premium_2_pack",
  "premium_4_pack",
  "team_transport",
  "premium_f1_single",
  "rlc",
  "elite_64",
  "convention",
  "collector_edition",
  "matchbox_collectors",
  "boxed_set",
  "unknown",
]);

export const ChaseMarkerSchema = z.enum([
  "low_production_vehicle_symbol",
  "circle_flame_card_symbol",
  "gold_circle_flame_card_symbol",
  "th_body_tampo",
  "spectraflame_paint",
  "real_riders",
  "zero_of_set",
  "premium_chase_colorway",
  "rlc_branding_or_numbering",
  "convention_branding",
]);

export const ReleaseClassSchema = z.enum([
  "mainline",
  "silver",
  "premium",
  "ultra_premium",
  "collector_edition",
  "verified_limited",
  "unknown",
]);

export const CastingSignalSchema = z.enum([
  "licensed_vehicle",
  "fantasy_casting",
  "new_model",
  "motorsport_subject",
  "historically_significant_model",
  "collaboration",
]);

export const ExecutionSignalSchema = z.enum([
  "metal_body",
  "metal_chassis",
  "real_riders",
  "spectraflame",
  "opening_feature",
  "detailed_livery",
  "premium_card",
  "display_case",
]);

export const CultureLaneSchema = z.enum([
  "ferrari",
  "jdm_nissan",
  "jdm_other",
  "porsche",
  "lamborghini",
  "muscle",
  "motorsport",
  "rally",
  "other",
]);

export const IdentificationSchema = z.object({
  brand: shortText,
  casting: shortText,
  tooling: optionalShortText,
  releaseYear: z.number().int().min(1968).max(2100).nullable(),
  line: shortText,
  category: ProductCategorySchema,
  seriesOrMix: optionalShortText,
  collectorNumber: optionalShortText,
  colorOrLivery: optionalShortText,
  productCode: optionalShortText,
  wheelType: optionalShortText,
  chaseStatus: ChaseStatusSchema,
  chaseMarkersObserved: z.array(ChaseMarkerSchema).max(9),
  cardType: optionalShortText,
  region: optionalShortText,
  confidence: ConfidenceSchema,
}).strict();

export const DecisionFeaturesSchema = z.object({
  releaseClass: ReleaseClassSchema,
  castingSignals: z.array(CastingSignalSchema).max(6),
  executionSignals: z.array(ExecutionSignalSchema).max(8),
  cultureLanes: z.array(CultureLaneSchema).max(5),
  featureEvidence: z.array(evidenceText).max(14),
}).strict();

export const SoldCompSchema = z.object({
  sourceUrl: z.string().url().max(500),
  soldAt: z.string().date(),
  price: z.number().positive().max(1_000_000),
  currency: z.enum(["EUR", "USD", "GBP", "CAD", "AUD"]),
  matchQuality: z.enum(["exact", "near", "unknown"]),
  condition: shortText,
  packaging: shortText,
}).strict();

export const MarketEvidenceSchema = z.object({
  exactSoldComps: z.array(SoldCompSchema).max(12),
  notes: z.array(evidenceText).max(6),
}).strict();

export const ComponentSchema = z.object({
  releaseSignificance: z.number().int().min(0).max(25),
  castingDesirability: z.number().int().min(0).max(20),
  lineExecution: z.number().int().min(0).max(15),
  cultureStory: z.number().int().min(0).max(15),
  marketLiquidity: z.number().int().min(0).max(10),
  personalFit: z.number().int().min(0).max(10),
  riskClarity: z.number().int().min(0).max(5),
}).strict();

export const ConditionSchema = z.object({
  grade: z.enum(["mint", "excellent", "good", "fair", "poor", "unknown"]),
  card: z.array(evidenceText).max(6),
  blister: z.array(evidenceText).max(6),
  visibleError: z.string().trim().min(1).max(240).nullable(),
}).strict();

export const PriceObservationSchema = z.object({
  amount: z.number().nonnegative().max(100_000).nullable(),
  currency: z.enum(["EUR", "USD", "GBP", "CAD", "AUD", "unknown"]),
  evidence: z.string().trim().min(1).max(160).nullable(),
}).strict();

export const CarObservationSchema = z.object({
  observationId: z.string().trim().min(1).max(80),
  identification: IdentificationSchema,
  decisionFeatures: DecisionFeaturesSchema,
  marketEvidence: MarketEvidenceSchema,
  condition: ConditionSchema,
  priceObservation: PriceObservationSchema,
  evidenceObserved: z.array(evidenceText).max(16),
  verificationNeeded: z.array(evidenceText).max(12),
}).strict();

export const PhotoAnalysisSchema = z.object({
  cars: z.array(CarObservationSchema).min(1).max(20),
  scene: z.object({
    retailer: optionalShortText,
    countryCode: z.string().length(2).nullable(),
    unassignedPriceObserved: z.number().nonnegative().max(100_000).nullable(),
    currency: z.enum(["EUR", "USD", "GBP", "CAD", "AUD", "unknown"]),
    caseOrMixInference: optionalShortText,
    inferenceEvidence: z.array(evidenceText).max(8),
  }).strict(),
  proactiveTargets: z.array(z.object({
    name: shortText,
    reason: evidenceText,
    visualMarkers: z.array(evidenceText).max(6),
    confidence: ConfidenceSchema,
  }).strict()).max(10),
  limitations: z.array(evidenceText).max(10),
}).strict();

export const AnalyzeOptionsSchema = z.object({
  market: z.literal("US").default("US"),
  observedPrice: z.coerce.number().nonnegative().max(100_000).optional(),
  currency: z.literal("USD").optional(),
  copyIntent: z.enum(["unspecified", "first_copy", "sealed_copy", "opener_copy", "gift"]).default("unspecified"),
}).strict();

export type Identification = z.infer<typeof IdentificationSchema>;
export type CarObservation = z.infer<typeof CarObservationSchema>;
export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;
export type ScoreComponents = z.infer<typeof ComponentSchema>;
export type ConditionGrade = z.infer<typeof ConditionSchema>["grade"];
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type CopyIntent = z.infer<typeof AnalyzeOptionsSchema>["copyIntent"];
export type Analysis = CarObservation;
