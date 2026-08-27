import { NextResponse } from "next/server";
import ireland from "@/data/ireland-targets-2026-08-02.json";
import hunts from "@/data/hunt-map-2026.json";
export async function GET() { return NextResponse.json({ ireland, hunts }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }); }
