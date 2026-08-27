import { NextRequest, NextResponse } from "next/server";
import { AnalyzeOptionsSchema } from "@/lib/analysis-schema";
import { analyzeCarEvidence } from "@/lib/openai-analysis";
import { persistPhotoEvaluation } from "@/lib/db";
import { classifyAnalysisError } from "@/lib/operational-errors";
import { evaluateUSPrice, inferPriceCategory } from "@/lib/pricing";
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
    const parsed = AnalyzeOptionsSchema.safeParse({ market: form.get("market") ?? "US", observedPrice: form.get("observedPrice") || undefined, currency: form.get("currency") || undefined });
    if (!parsed.success) return NextResponse.json({ error: "Invalid market or price", traceId }, { status: 400 });
    const images = form.getAll("images").filter((x): x is File => x instanceof File && x.size > 0);
    const query = String(form.get("query") ?? "").trim().slice(0, 160);
    if (!images.length && query.length < 2) return NextResponse.json({ error: "Take a photo, choose an image, or enter a car name", traceId }, { status: 400 });
    if (images.length > MAX_FILES) return NextResponse.json({ error: `Upload no more than ${MAX_FILES} images`, traceId }, { status: 400 });
    const dataUrls: string[] = [];
    for (const image of images) { if (image.size > MAX_BYTES) return NextResponse.json({ error: "Each image must be 10 MB or smaller", traceId }, { status: 413 }); const bytes = Buffer.from(await image.arrayBuffer()); if (!isSupportedImage(bytes, image.type)) return NextResponse.json({ error: "Invalid JPEG, PNG, or WebP file", traceId }, { status: 415 }); dataUrls.push(`data:${image.type};base64,${bytes.toString("base64")}`); }
    const { analysis, requestId } = await analyzeCarEvidence(dataUrls, query, parsed.data.market);
    const cars = analysis.cars.map((observation) => { const score = scoreObservation(observation); const observedPrice = parsed.data.observedPrice ?? analysis.scene.priceObserved; const priceGate = evaluateUSPrice(inferPriceCategory(observation.identification.line), observedPrice); return { ...observation, score, rank: 0, marketEvidenceGrade: marketEvidenceGrade(observation), recommendation: recommendationFor(observation, score.total), priceGate }; }).sort((a, b) => b.score.total - a.score.total).map((car, index) => ({ ...car, rank: index + 1 }));
    let evaluationId: string | null = null;
    let persistenceWarning: string | null = null;
    try {
      evaluationId = await persistPhotoEvaluation(analysis, cars, { traceId, market: parsed.data.market, modelRequestId: requestId, evidenceMode: dataUrls.length ? "image" : "text", query: query || null });
    } catch (error) {
      persistenceWarning = "Analysis completed, but the result could not be saved to the collection database.";
      console.error(JSON.stringify({ level: "error", event: "persistence_failed", traceId, error: error instanceof Error ? error.message : "unknown" }));
    }
    return NextResponse.json({ traceId, evaluationId, persistenceWarning, market: parsed.data.market, cars, scene: analysis.scene, proactiveTargets: analysis.proactiveTargets, limitations: analysis.limitations });
  } catch (error) {
    const failure = classifyAnalysisError(error);
    const provider = error as { status?: unknown; code?: unknown; type?: unknown; name?: unknown; request_id?: unknown };
    console.error(JSON.stringify({ level: "error", event: "analysis_failed", traceId, code: failure.code, providerStatus: provider.status ?? null, providerCode: provider.code ?? null, providerType: provider.type ?? null, providerName: provider.name ?? null, providerRequestId: provider.request_id ?? null, error: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: failure.message, code: failure.code, traceId }, { status: failure.status });
  }
}
