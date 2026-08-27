import { NextResponse } from "next/server";
import hunts from "@/data/hunt-map-2026.json";
export async function GET() { return NextResponse.json({ market: "US", currency: "USD", hunts }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }); }
