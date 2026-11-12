import { describe, expect, it } from "vitest";
import { evaluateIrishPrice, evaluateUSPrice, inferPriceCategory, resolveItemPrice } from "../lib/pricing";
import { ferrari } from "./fixtures";

const now = new Date("2026-11-11T12:00:00Z");

describe("regional retail gates", () => {
  it("keeps unverified Irish premium categories unavailable", () => expect(evaluateIrishPrice("premium_single", 9.99, "EUR", now).verdict).toBe("unknown"));
  it("does not carry unsupported premium pricing into a renewed snapshot", () => expect(evaluateUSPrice("premium_single", 5.5, "USD", now).verdict).toBe("unknown"));
  it("uses the reviewed five-pack item price rather than an older search-listing price", () => {
    expect(evaluateUSPrice("five_pack", 6.19, "USD", now)).toMatchObject({ verdict: "fair", benchmark: { normalPrice: 6.19 } });
    expect(evaluateUSPrice("five_pack", 5, "USD", now).verdict).toBe("strong_buy");
  });
  it("expires the renewed US benchmark after the inclusive 45-day window", () => {
    expect(evaluateUSPrice("team_transport", 16.99, "USD", new Date("2026-12-26T23:59:59Z")).verdict).toBe("fair");
    expect(evaluateUSPrice("team_transport", 16.99, "USD", new Date("2026-12-27T00:00:00Z")).verdict).toBe("unknown");
  });
  it("uses the reviewed Irish assortment references without inventing exact availability", () => {
    expect(evaluateIrishPrice("five_pack", 8.99, "EUR", now)).toMatchObject({ verdict: "fair", benchmark: { retailer: "Ken Black", normalPrice: 8.99 } });
    expect(evaluateIrishPrice("ten_pack", 13.99, "EUR", now).verdict).toBe("fair");
  });
  it("flags an inflated Team Transport", () => expect(evaluateUSPrice("team_transport", 22, "USD", now).verdict).toBe("overpriced"));
  it("does not fabricate an unsupported benchmark", () => expect(evaluateUSPrice("premium_2_pack", 15, "USD", now).verdict).toBe("unknown"));
  it("does not default an unknown line to mainline", () => expect(inferPriceCategory("Mystery release")).toBe("unknown"));
  it("does not convert a foreign price implicitly", () => expect(evaluateUSPrice("premium_single", 6, "EUR", now).verdict).toBe("unknown"));
});

describe("per-item price association", () => {
  it("uses a collector-entered price only for a single result", () => {
    const analysis = {
      cars: [ferrari],
      scene: { retailer: null, countryCode: "US", unassignedPriceObserved: null, currency: "USD" as const, caseOrMixInference: null, inferenceEvidence: [] },
      proactiveTargets: [],
      limitations: [],
    };
    expect(resolveItemPrice(ferrari, analysis, { observedPrice: 6.5, currency: "USD" }).source).toBe("collector_item_input");
  });

  it("leaves a scene price unassigned when multiple cars are present", () => {
    const second = { ...ferrari, observationId: "car-2" };
    const analysis = {
      cars: [ferrari, second],
      scene: { retailer: null, countryCode: "US", unassignedPriceObserved: 6.5, currency: "USD" as const, caseOrMixInference: null, inferenceEvidence: [] },
      proactiveTargets: [],
      limitations: [],
    };
    expect(resolveItemPrice(ferrari, analysis, { observedPrice: 6.5, currency: "USD" }).source).toBe("unassigned");
  });
});
