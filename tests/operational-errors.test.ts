import { describe, expect, it } from "vitest";
import { classifyAnalysisError } from "../lib/operational-errors";

describe("analysis error classification", () => {
  it("turns provider authentication failures into an actionable safe message", () => {
    expect(classifyAnalysisError({ status: 401 })).toMatchObject({
      code: "openai_authentication_failed",
      status: 503,
    });
  });

  it("distinguishes exhausted quota from transient rate limiting", () => {
    expect(classifyAnalysisError({ status: 429, code: "insufficient_quota" })).toMatchObject({
      code: "openai_quota_unavailable",
      status: 503,
    });
    expect(classifyAnalysisError({ status: 429 })).toMatchObject({
      code: "openai_rate_limited",
      status: 429,
    });
  });

  it("does not expose an unknown provider error", () => {
    const result = classifyAnalysisError(new Error("secret provider detail"));
    expect(result.code).toBe("analysis_failed");
    expect(result.message).not.toContain("secret provider detail");
  });
});
