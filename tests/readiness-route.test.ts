import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/ready/route";

describe("readiness route", () => {
  it("does not disclose dependency state without the readiness token", async () => {
    const response = await GET(new NextRequest("https://example.test/api/ready"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

