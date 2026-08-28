import { NextRequest, NextResponse } from "next/server";
import { CarObservationSchema } from "../../../lib/analysis-schema";
import { comparableExactCompCount, marketEvidenceGrade, recommendationFor, scoreObservation } from "../../../lib/scoring";
import { isAllowedOrigin, NO_STORE_HEADERS } from "../../../lib/security";
import { authenticateOwner } from "../../../lib/security/owner-session";

export const runtime = "nodejs";

const MAX_SCORE_BODY_BYTES = 256 * 1024;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request.url, request.headers.get("origin"))) {
    return json({ error: "Request rejected" }, 403);
  }

  const identity = await authenticateOwner(request);
  if (!identity.authenticated) {
    return json(
      {
        error: identity.status === 503 ? "Scoring is temporarily unavailable" : "Sign in is required",
        code: identity.status === 503 ? "owner_auth_unavailable" : "owner_auth_required",
      },
      identity.status === 503 ? 503 : 401,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SCORE_BODY_BYTES) {
    return json({ error: "Observation is too large" }, 413);
  }

  const rawBody = await request.text().catch(() => null);
  if (rawBody === null) return json({ error: "Invalid observation" }, 400);
  if (new TextEncoder().encode(rawBody).byteLength > MAX_SCORE_BODY_BYTES) {
    return json({ error: "Observation is too large" }, 413);
  }

  const parsed = CarObservationSchema.safeParse((() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })());
  if (!parsed.success) {
    return json({ error: "Invalid observation", issues: parsed.error.issues }, 400);
  }

  const score = scoreObservation(parsed.data);
  return json({
    score,
    marketEvidenceGrade: marketEvidenceGrade(parsed.data),
    marketEvidenceCount: comparableExactCompCount(parsed.data),
    recommendation: recommendationFor(parsed.data, score.total),
  });
}
