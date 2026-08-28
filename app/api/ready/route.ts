import { NextRequest, NextResponse } from "next/server";
import { hasReadinessToken, NO_STORE_HEADERS } from "../../../lib/security";
import { getSupabaseServiceClient, hasSupabaseServiceConfiguration } from "../../../lib/security/service-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasReadinessToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const configured =
    Boolean(process.env.OPENAI_API_KEY) &&
    Boolean(process.env.HOTWHEELS_OWNER_USER_ID) &&
    Boolean(process.env.HOTWHEELS_SAFETY_ID_SECRET) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
    hasSupabaseServiceConfiguration();
  if (!configured) {
    console.error(JSON.stringify({ level: "error", event: "readiness_configuration_incomplete" }));
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  try {
    const database = getSupabaseServiceClient();
    const [evaluations, usage] = await Promise.all([
      database.from("photo_evaluations").select("id").limit(1),
      database.from("model_usage_events").select("id").limit(1),
    ]);
    if (evaluations.error) throw evaluations.error;
    if (usage.error) throw usage.error;
    return NextResponse.json({ status: "ready" }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "readiness_database_unavailable",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: NO_STORE_HEADERS });
  }
}
