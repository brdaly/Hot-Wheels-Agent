import { describe, expect, it } from "vitest";
import { PUBLIC_DEMO_RULESET, publicDemoScenarios } from "../data/public-demo-scenarios";
import { SCORE_MODEL_VERSION, tierFor } from "../lib/scoring";

describe("public fictional demo provenance", () => {
  it("publishes the same decision-policy version as live deterministic scoring", () => {
    expect(PUBLIC_DEMO_RULESET).toBe(SCORE_MODEL_VERSION);
  });

  it("keeps every displayed sample score aligned with the live tier thresholds", () => {
    for (const scenario of publicDemoScenarios) {
      const collectionFit = scenario.signals.find((signal) => signal.label === "Collection fit")?.value ?? "";
      const match = collectionFit.match(/^(\d+)\/100 · (\S+)$/);
      expect(match, scenario.id).not.toBeNull();
      expect(match?.[2]).toBe(tierFor(Number(match?.[1])));
    }
  });
});
