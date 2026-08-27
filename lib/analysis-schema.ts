import { z } from "zod";

export const ChaseStatusSchema = z.enum(["none", "regular_th", "super_th", "premium_chase", "rlc", "convention", "error", "unknown"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const IdentificationSchema = z.object({
  brand: z.string().min(1), casting: z.string().min(1),
  releaseYear: z.number().int().min(1968).max(2100).nullable(),
  line: z.string().min(1), seriesOrMix: z.string().nullable(), collectorNumber: z.string().nullable(),
  colorOrLivery: z.string().nullable(), productCode: z.string().nullable(), chaseStatus: ChaseStatusSchema,
  chaseMarkersObserved: z.array(z.string()).max(8), cardType: z.string().nullable(), confidence: ConfidenceSchema,
});

export const ComponentSchema = z.object({
  releaseSignificance: z.number().int().min(0).max(25), castingDesirability: z.number().int().min(0).max(20),
  lineExecution: z.number().int().min(0).max(15), cultureStory: z.number().int().min(0).max(15),
  marketLiquidity: z.number().int().min(0).max(10), personalFit: z.number().int().min(0).max(10),
  riskClarity: z.number().int().min(0).max(5),
});

export const ConditionSchema = z.object({
  grade: z.enum(["mint", "excellent", "good", "fair", "poor", "unknown"]),
  card: z.array(z.string()).max(6), blister: z.array(z.string()).max(6), visibleError: z.string().nullable(),
});

export const CarObservationSchema = z.object({
  observationId: z.string().min(1), identification: IdentificationSchema, proposedComponents: ComponentSchema,
  condition: ConditionSchema, evidenceObserved: z.array(z.string()).max(12), verificationNeeded: z.array(z.string()).max(10),
});

export const PhotoAnalysisSchema = z.object({
  cars: z.array(CarObservationSchema).min(1).max(20),
  scene: z.object({
    retailer: z.string().nullable(), countryCode: z.string().length(2).nullable(),
    priceObserved: z.number().nonnegative().nullable(), currency: z.enum(["EUR", "USD", "GBP", "CAD", "AUD", "unknown"]),
    caseOrMixInference: z.string().nullable(), inferenceEvidence: z.array(z.string()).max(8),
  }),
  proactiveTargets: z.array(z.object({
    name: z.string(), reason: z.string(), visualMarkers: z.array(z.string()).max(6), confidence: ConfidenceSchema,
  })).max(10),
  limitations: z.array(z.string()).max(8),
});

export const AnalyzeOptionsSchema = z.object({
  market: z.enum(["IE", "US"]).default("IE"), observedPrice: z.coerce.number().nonnegative().optional(),
  currency: z.enum(["EUR", "USD"]).optional(),
});

export type Identification = z.infer<typeof IdentificationSchema>;
export type CarObservation = z.infer<typeof CarObservationSchema>;
export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;
export type ScoreComponents = z.infer<typeof ComponentSchema>;
export type ConditionGrade = z.infer<typeof ConditionSchema>["grade"];
export type Analysis = CarObservation;
