import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HUNT_IMAGES } from "../../../lib/private-hunt-images";
import { NO_STORE_HEADERS } from "../../../lib/security";
import { authenticateOwner } from "../../../lib/security/owner-session";

export const runtime = "nodejs";

const PRIVATE_RESPONSE_HEADERS = {
  ...NO_STORE_HEADERS,
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
} as const;

export async function GET(request: NextRequest) {
  const developmentBypass = process.env.NODE_ENV !== "production" && process.env.HOTWHEELS_DEV_AUTH_BYPASS === "true";
  const identity = developmentBypass ? { authenticated: true as const } : await authenticateOwner(request);

  if (!identity.authenticated) {
    return NextResponse.json(
      {
        error: identity.status === 503 ? "Private reference images are temporarily unavailable" : "Owner sign-in is required",
        code: identity.status === 503 ? "owner_auth_unavailable" : "owner_auth_required",
      },
      { status: identity.status === 503 ? 503 : 401, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      mode: "private_personal_prototype",
      audience: "Brendan Daly owner session only",
      licensedForPublicDistribution: false,
      images: PRIVATE_HUNT_IMAGES,
    },
    { headers: PRIVATE_RESPONSE_HEADERS },
  );
}
