import { describe, expect, it } from "vitest";
import { scoreObservation, tierFor, totalScore } from "../lib/scoring";
import { ferrari } from "./fixtures";

describe("Collection Priority Score v3.0", () => {
  it("sums all seven bounded components", () => {
    expect(totalScore({
      releaseSignificance: 25,
      castingDesirability: 20,
      lineExecution: 15,
      cultureStory: 15,
      marketLiquidity: 10,
      personalFit: 10,
      riskClarity: 5,
    })).toBe(100);
  });

  it.each([[95, "S+"], [90, "S"], [85, "A+"], [80, "A"], [75, "B+"], [55, "B"], [40, "C"], [39, "D"]])(
    "maps %i to %s",
    (score, tier) => expect(tierFor(score)).toBe(tier),
  );

  it("rejects a component above its maximum", () => {
    expect(() => totalScore({
      releaseSignificance: 26,
      castingDesirability: 20,
      lineExecution: 15,
      cultureStory: 15,
      marketLiquidity: 10,
      personalFit: 10,
      riskClarity: 5,
    })).toThrow(RangeError);
  });

  it("derives points from named evidence features and explains each component", () => {
    const score = scoreObservation(ferrari);
    expect(score.components.marketLiquidity).toBe(0);
    expect(score.components.personalFit).toBe(10);
    expect(score.componentReasons.marketLiquidity).toMatch(/No recent exact/);
    expect(Object.keys(score.componentReasons)).toHaveLength(7);
  });
});
