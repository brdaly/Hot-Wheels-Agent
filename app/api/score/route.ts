import { NextRequest, NextResponse } from "next/server";
import { CarObservationSchema } from "@/lib/analysis-schema";
import { marketEvidenceGrade, recommendationFor, scoreObservation } from "@/lib/scoring";
export async function POST(request: NextRequest) { const parsed = CarObservationSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid observation", issues: parsed.error.issues }, { status: 400 }); const score = scoreObservation(parsed.data); return NextResponse.json({ score, marketEvidenceGrade: marketEvidenceGrade(parsed.data), recommendation: recommendationFor(parsed.data, score.total) }); }
