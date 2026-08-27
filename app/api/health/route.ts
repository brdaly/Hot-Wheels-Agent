import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "hot-wheels-frontier-agent", version: "0.3.0", scoreModel: "collection-priority-v2.0", market: "US", analysisConfigured: Boolean(process.env.OPENAI_API_KEY), databaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) });
}
