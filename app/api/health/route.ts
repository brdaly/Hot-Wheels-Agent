import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "hot-wheels-frontier-agent", version: "0.2.0", scoreModel: "collection-priority-v2.0", databaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) });
}
