import { NextResponse } from "next/server";
import ireland from "@/data/ireland-retail-2026-08-02.json";
export async function GET() { return NextResponse.json(ireland, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }); }
