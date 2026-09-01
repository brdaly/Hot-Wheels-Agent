import { NextRequest, NextResponse } from "next/server";
import { AnalyzeOptionsSchema } from "@/lib/analysis-schema";
import { deterministicCaseInference, findChaseReference } from "@/lib/collector-reference";
import { ownedQuantitiesByFingerprint, persistPhotoEvaluation, recordModelUsage } from "@/lib/db";
import {
  MAX_IMAGE_FILES,
  MAX_TOTAL_UPLOAD_BYTES,
  normalizeEvidenceImage,
} from "@/lib/image-processing";
import { analyzeCarEvidence } from "@/lib/openai-analysis";
import { classifyAnalysisError } from "@/lib/operational-errors";
import { evaluateUSPrice, resolveItemPrice } from "@/lib/pricing";
import { releaseFingerprint } from "@/lib/release-fingerprint";
import {
  comparableExactCompCount,
  exactReleaseGate,
  marketEvidenceGrade,
  recommendationFor,
  scoreObservation,
  visualEvidenceGrade,
} from "@/lib/scoring";
import {
  isAllowedOrigin,
  NO_STORE_HEADERS,
  rateLimit,
  trustedClientIp,
} from "@/lib/security";
import { acquireAnalysisLease, releaseAnalysisLease } from "@/lib/security/distributed-concurrency";
import { consumeDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { authenticateOwner, type OwnerIdentity } from "@/lib/security/owner-session";
import { SOURCE_CATALOG } from "@/lib/source-registry";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FORM_OVERHEAD_BYTES = 512 * 1024;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE_HEADERS, ...headers } });
}

function positiveIntegerEnvironment(name: string, fallback: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(maximum, value) : fallback;
}

async function ownerForRequest(request: NextRequest): Promise<(OwnerIdentity & { developmentBypass?: boolean }) | null> {
  const identity = await authenticateOwner(request);
  if (identity.authenticated) return identity;
  if (process.env.NODE_ENV !== "production" && process.env.HOTWHEELS_DEV_AUTH_BYPASS === "true") {
    return {
      authenticated: true,
      accessToken: "",
      safetyIdentifier: "hw_local_development",
      userId: "00000000-0000-4000-8000-000000000000",
      developmentBypass: true,
    };
  }
  return null;
}

async function consumeAnalysisQuota(identity: OwnerIdentity & { developmentBypass?: boolean }, ip: string) {
  const hourly = positiveIntegerEnvironment("HOTWHEELS_HOURLY_ANALYSIS_LIMIT", 10, 100);
  const daily = positiveIntegerEnvironment("HOTWHEELS_DAILY_ANALYSIS_LIMIT", 40, 1_000);
  if (identity.developmentBypass) {
    const local = rateLimit(`analysis:${ip}`, hourly, 60 * 60 * 1_000);
    return { allowed: local.allowed, available: true, retryAfterSeconds: local.allowed ? 0 : 60 };
  }
  const [hourResult, dayResult] = await Promise.all([
    consumeDistributedRateLimit({
      scope: "analysis_hour",
      subject: identity.userId,
      capacity: hourly,
      refillPerSecond: hourly / 3_600,
    }),
    consumeDistributedRateLimit({
      scope: "analysis_day",
      subject: identity.userId,
      capacity: daily,
      refillPerSecond: daily / 86_400,
    }),
  ]);
  return {
    allowed: hourResult.allowed && dayResult.allowed,
    available: hourResult.available && dayResult.available,
    retryAfterSeconds: Math.max(hourResult.retryAfterSeconds, dayResult.retryAfterSeconds),
  };
}

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID();
  if (process.env.HOTWHEELS_ANALYSIS_ENABLED === "false") {
    return json({ error: "Live AI analysis is temporarily paused", code: "analysis_paused", traceId }, 503);
  }
  const ip = trustedClientIp(request.headers);
  if (!isAllowedOrigin(request.url, request.headers.get("origin"))) {
    return json({ error: "Request rejected", traceId }, 403);
  }
  const identity = await ownerForRequest(request);
  if (!identity) return json({ error: "Sign in is required", code: "owner_auth_required", traceId }, 401);

  const quota = await consumeAnalysisQuota(identity, ip);
  if (!quota.available) return json({ error: "Analysis capacity is temporarily unavailable", code: "quota_unavailable", traceId }, 503, { "Retry-After": String(quota.retryAfterSeconds) });
  if (!quota.allowed) return json({ error: "Analysis limit reached. Try again later.", code: "analysis_rate_limited", traceId }, 429, { "Retry-After": String(quota.retryAfterSeconds) });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return json({ error: "Evidence must be submitted as a form", traceId }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TOTAL_UPLOAD_BYTES + MAX_FORM_OVERHEAD_BYTES) {
    return json({ error: "The evidence bundle is too large", traceId }, 413);
  }

  let leaseId: string | null = null;
  const startedAt = Date.now();
  try {
    if (!process.env.OPENAI_API_KEY) return json({ error: "Analysis service is not configured", traceId }, 503);
    const form = await request.formData();
    const parsed = AnalyzeOptionsSchema.safeParse({
      market: form.get("market") ?? "US",
      observedPrice: form.get("observedPrice") || undefined,
      currency: form.get("currency") || undefined,
      copyIntent: form.get("copyIntent") ?? "unspecified",
    });
    if (!parsed.success) return json({ error: "Invalid market, item price or copy intent", traceId }, 400);

    const rawQuery = String(form.get("query") ?? "").trim();
    if (rawQuery.length > 160) return json({ error: "Car search text must be 160 characters or fewer", traceId }, 400);
    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
    if (!images.length && rawQuery.length < 2) return json({ error: "Take a photo, choose an image, or enter a car name", traceId }, 400);
    if (images.length > MAX_IMAGE_FILES) return json({ error: `Upload no more than ${MAX_IMAGE_FILES} images`, traceId }, 400);
    const totalImageBytes = images.reduce((total, image) => total + image.size, 0);
    if (totalImageBytes > MAX_TOTAL_UPLOAD_BYTES) return json({ error: "The evidence bundle is too large", traceId }, 413);

    const normalizedImages: Awaited<ReturnType<typeof normalizeEvidenceImage>>[] = [];
    for (const image of images) {
      try {
        normalizedImages.push(await normalizeEvidenceImage(image));
      } catch (error) {
        const status = error instanceof RangeError ? 413 : 415;
        return json({ error: status === 413 ? "An image is too large" : "Use a valid JPEG, PNG or WebP image", traceId }, status);
      }
    }

    if (!identity.developmentBypass) {
      const lease = await acquireAnalysisLease(identity.userId, positiveIntegerEnvironment("HOTWHEELS_MAX_CONCURRENT_ANALYSES", 2, 10));
      if (!lease.available) return json({ error: "Analysis capacity is temporarily unavailable", traceId }, 503, { "Retry-After": "30" });
      if (!lease.acquired) return json({ error: "Another analysis is already running. Try again shortly.", traceId }, 429, { "Retry-After": "15" });
      leaseId = lease.leaseId;
    }

    const providerResult = await analyzeCarEvidence(
      normalizedImages.map((image) => image.dataUrl),
      rawQuery,
      parsed.data.market,
      identity.safetyIdentifier,
    );
    const analysis = {
      ...providerResult.analysis,
      cars: providerResult.analysis.cars.map((car) => ({
        ...car,
        marketEvidence: {
          exactSoldComps: [],
          comparisonCurrency: null,
          notes: [...car.marketEvidence.notes, "Model-stage market claims are not accepted as completed-sale evidence."].slice(0, 6),
        },
      })),
    };

    const fingerprints = analysis.cars.map((car) => releaseFingerprint(car.identification));
    let ownedQuantities: Record<string, number> = {};
    let collectionWarning: string | null = null;
    try {
      ownedQuantities = await ownedQuantitiesByFingerprint(
        fingerprints.flatMap((item) => item.status === "exact" ? item.aliases : []),
        identity.developmentBypass ? undefined : identity.userId,
      );
    } catch (error) {
      collectionWarning = "Collection matching was unavailable; duplicate guidance is provisional.";
      console.error(JSON.stringify({ level: "error", event: "collection_context_failed", traceId, error: error instanceof Error ? error.message : "unknown" }));
    }

    const cars = analysis.cars.map((observation, originalIndex) => {
      const fingerprint = releaseFingerprint(observation.identification);
      const score = scoreObservation(observation);
      const itemPrice = resolveItemPrice(observation, analysis, {
        observedPrice: parsed.data.observedPrice,
        currency: parsed.data.currency,
      });
      const priceGate = evaluateUSPrice(observation.identification.category, itemPrice.amount, itemPrice.currency);
      const releaseGate = exactReleaseGate(observation);
      const recommendation = recommendationFor(observation, score.total, {
        ownedQuantity: fingerprint.status === "exact"
          ? Math.max(0, ...fingerprint.aliases.map((alias) => ownedQuantities[alias] ?? 0))
          : 0,
        copyIntent: parsed.data.copyIntent,
      });
      const referenceMatch = findChaseReference(observation.identification);
      const referenceSources = referenceMatch.entry ? [
        ...referenceMatch.sources.map((source) => ({
          id: source.url,
          label: source.name,
          kind: "Specialist secondary cross-check",
          authority: "specialist_secondary",
          url: source.url,
          asOf: source.retrievedAt,
          freshness: "current",
          note: source.use,
        })),
        {
          id: referenceMatch.entry.sourceUrl,
          label: "Exact-release reference page",
          kind: "Attributed external release reference",
          authority: "specialist_secondary",
          url: referenceMatch.entry.sourceUrl,
          asOf: "2026-08-28",
          freshness: "current",
          note: "Link-only reference; image rights remain with the source publisher.",
        },
      ] : [];
      return {
        ...observation,
        score,
        originalIndex,
        rank: 0,
        releaseFingerprint: fingerprint,
        decisionReady: releaseGate.ready,
        visualEvidenceGrade: visualEvidenceGrade(observation),
        marketEvidenceGrade: marketEvidenceGrade(observation),
        marketEvidenceCount: comparableExactCompCount(observation),
        recommendation,
        itemPrice,
        priceGate,
        referenceMatch,
        sources: referenceSources,
      };
    }).sort((left, right) =>
      Number(right.decisionReady) - Number(left.decisionReady) ||
      right.score.total - left.score.total ||
      left.originalIndex - right.originalIndex
    ).map((car, index) => ({ ...car, rank: index + 1 }));

    const deterministicCase = deterministicCaseInference(analysis.cars);
    const limitations = [...analysis.limitations];
    if (providerResult.analysis.scene.caseOrMixInference && !deterministicCase) {
      limitations.push("The model's case/mix lead was withheld because dated source data did not independently support it.");
    }
    if (analysis.proactiveTargets.length) {
      limitations.push("Proactive targets are low-confidence leads until their exact release and current source data are verified.");
    }
    const proactiveTargets = analysis.proactiveTargets.map((target) => ({
      ...target,
      confidence: "low" as const,
      status: "verification_lead" as const,
    }));
    const scene = {
      ...analysis.scene,
      caseOrMixInference: deterministicCase?.value ?? null,
      inferenceEvidence: deterministicCase?.evidence ?? [],
      inferenceSources: deterministicCase?.sources ?? [],
      confidence: deterministicCase?.confidence ?? "low",
    };
    const sanitizedAnalysis = {
      ...analysis,
      scene,
      proactiveTargets,
      limitations: [...new Set(limitations)],
    };

    const runtime = {
      ...providerResult.runtime,
      sourceCatalogVersion: SOURCE_CATALOG.schemaVersion,
      sourceCatalogRetrievedOn: SOURCE_CATALOG.retrievedOn,
      scoreVersion: cars[0]?.score.modelVersion ?? null,
    };
    const metadata = {
      traceId,
      market: parsed.data.market,
      modelRequestId: providerResult.requestId,
      evidenceMode: normalizedImages.length ? "image" : "text",
      queryPresent: Boolean(rawQuery),
      imagePipeline: normalizedImages.map((image) => image.metadata),
      runtime,
    };

    let evaluationId: string | null = null;
    let persistenceWarning: string | null = collectionWarning;
    try {
      evaluationId = await persistPhotoEvaluation(sanitizedAnalysis, cars, metadata, identity.developmentBypass ? undefined : identity.userId);
    } catch (error) {
      persistenceWarning = [persistenceWarning, "Analysis completed, but the result was not saved."].filter(Boolean).join(" ");
      console.error(JSON.stringify({ level: "error", event: "persistence_failed", traceId, error: error instanceof Error ? error.message : "unknown" }));
    }
    if (!identity.developmentBypass) {
      try {
        await recordModelUsage({
          ownerId: identity.userId,
          traceId,
          providerRequestId: providerResult.requestId,
          model: providerResult.runtime.model,
          usage: providerResult.usage,
          latencyMs: Date.now() - startedAt,
          runtime,
        });
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "usage_record_failed", traceId, error: error instanceof Error ? error.message : "unknown" }));
      }
    }

    return json({
      traceId,
      generatedAt: new Date().toISOString(),
      contractVersion: providerResult.runtime.schemaVersion,
      evaluationId,
      persistenceWarning,
      market: parsed.data.market,
      cars,
      scene,
      proactiveTargets,
      limitations: sanitizedAnalysis.limitations,
      runtime,
      privacy: {
        providerStorageRequested: false,
        localPersistenceEnabled: process.env.PERSIST_ANALYSES === "true",
      },
    });
  } catch (error) {
    const failure = classifyAnalysisError(error);
    const provider = error as { status?: unknown; code?: unknown; type?: unknown; name?: unknown; request_id?: unknown };
    console.error(JSON.stringify({
      level: "error",
      event: "analysis_failed",
      traceId,
      code: failure.code,
      providerStatus: provider.status ?? null,
      providerCode: provider.code ?? null,
      providerType: provider.type ?? null,
      providerName: provider.name ?? null,
      providerRequestId: provider.request_id ?? null,
      error: error instanceof Error ? error.message : "unknown",
    }));
    return json({ error: failure.message, code: failure.code, traceId }, failure.status);
  } finally {
    await releaseAnalysisLease(leaseId);
  }
}
