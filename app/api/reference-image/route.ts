import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const ALLOWED_HOST = "164custom.com";
const ALLOWED_PATH = "/images/HW/";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("src");
  if (!raw) return NextResponse.json({ error: "Missing image source" }, { status: 400 });

  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
  }

  if (source.protocol !== "https:" || source.hostname !== ALLOWED_HOST || !source.pathname.startsWith(ALLOWED_PATH)) {
    return NextResponse.json({ error: "Image source is not approved" }, { status: 403 });
  }

  try {
    const upstream = await fetch(source, {
      headers: { Accept: "image/avif,image/webp,image/jpeg,image/png,image/*", "User-Agent": "DalyVentures-HotWheels-Reference/0.4 (+https://dalyventures.com/)" },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) return NextResponse.json({ error: "Reference image unavailable" }, { status: 502 });
    const type = upstream.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return NextResponse.json({ error: "Reference did not return an image" }, { status: 415 });
    const contentLength = Number(upstream.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Reference image is too large" }, { status: 413 });
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Reference image is too large" }, { status: 413 });
    return new NextResponse(bytes, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'" } });
  } catch {
    return NextResponse.json({ error: "Reference image unavailable" }, { status: 502 });
  }
}
