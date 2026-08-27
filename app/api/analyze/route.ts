import { NextRequest, NextResponse } from "next/server";
import { AnalyzeOptionsSchema } from "@/lib/analysis-schema";
import { analyzeCarImages } from "@/lib/openai-analysis";
import { persistPhotoEvaluation } from "@/lib/db";
import { evaluateIrishPrice, inferPriceCategory } from "@/lib/pricing";
import { marketEvidenceGrade, recommendationFor, scoreObservation } from "@/lib/scoring";
import { isSupportedImage, rateLimit } from "@/lib/security";
export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024, MAX_FILES = 4;
export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID(), ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(ip).allowed) return NextResponse.json({ error: "Rate limit exceeded", traceId }, { status: 429 });
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Analysis service is not configured", traceId }, { status: 503 });
    const form = await request.formData();
    const parsed = AnalyzeOptionsSchema.safeParse({ market: form.get("market") ?? "IE", observedPrice: form.get("observedPrice") || undefined, currency: form.get("currency") || undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid market or price", traceId }, { status: 400 });
    const images = form.getAll("images").filter((x): x is File => x instanceof File);
    if (images.length < 1 || images.length > MAX_FILES) return NextResponse.json({ error: `Upload 1–${MAX_FILES} images`, traceId }, { status: 400 });
    const dataUrls: string[] = [];
    for (const image of images) { if (image.size > MAX_BYTES) return NextResponse.json({ error: "Each image must be 10 MB or smaller", traceId }, { status: 413 }); const bytes = Buffer.from(await image.arrayBuffer()); if (!isSupportedImage(bytes, image.type)) return NextResponse.json({ error: "Invalid JPEG, PNG, or WebP file", traceId }, { status: 415 }); dataUrls.push(`data:${image.type};base64,${bytes.toString("base64")}`); }
    const { analysis, requestId } = await analyzeCarImages(dataUrls, parsed.data.market);
    const cars = analysis.cars.map((observation) => { const score = scoreObservation(observation); const observedPrice = parsed.data.observedPrice ?? analysis.scene.priceObserved; const priceGate = parsed.data.market === "IE" ? evaluateIrishPrice(inferPriceCategory(observation.identification.line), observedPrice) : { verdict: "unknown" as const, note: "US benchmark requires an exact retailer." }; return { ...observation, score, rank: 0, marketEvidenceGrade: marketEvidenceGrade(observation), recommendation: recommendationFor(observation, score.total), priceGate }; }).sort((a, b) => b.score.total - a.score.total).map((car, index) => ({ ...car, rank: index + 1 }));
    const evaluationId = await persistPhotoEvaluation(analysis, cars, { traceId, market: parsed.data.market, modelRequestId: requestId });
    return NextResponse.json({ traceId, evaluationId, market: parsed.data.market, cars, scene: analysis.scene, proactiveTargets: analysis.proactiveTargets, limitations: analysis.limitations });
  } catch (error) { console.error(JSON.stringify({ level: "error", event: "analysis_failed", traceId, error: error instanceof Error ? error.message : "unknown" })); return NextResponse.json({ error: "Unable to complete the analysis", traceId }, { status: 500 }); }
}
