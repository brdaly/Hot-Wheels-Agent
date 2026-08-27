import { NextResponse } from "next/server";
import usRetail from "@/data/us-retail-2026-08-27.json";

export async function GET() {
  return NextResponse.json(usRetail, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
