import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../../../lib/security";

export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: NO_STORE_HEADERS });
}
