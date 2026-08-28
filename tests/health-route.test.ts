import { describe, expect, it } from "vitest";
import { GET } from "../app/api/health/route";

describe("liveness route", () => {
  it("returns no deployment or provider details and is never cacheable", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

