import { describe, expect, it } from "vitest";
import hunts from "../data/hunt-map-2026.json";
import { findChaseReference } from "../lib/collector-reference";
import { chaseVerification, exactReleaseGate } from "../lib/scoring";
import { ferrari } from "./fixtures";

describe("governed chase references", () => {
  it("uses exact attributed HWtreasure item pages and stores no third-party image URLs", () => {
    const serialized = JSON.stringify(hunts);
    expect(serialized).not.toContain("imageUrl");
    expect(serialized).not.toContain("164custom");
    for (const row of hunts.cases) {
      expect(row.super.sourceUrl).toMatch(/^https:\/\/www\.hwtreasure\.com\/2026-super\//);
      expect(row.treasure.sourceUrl).toMatch(/^https:\/\/www\.hwtreasure\.com\/2026-2\//);
    }
  });

  it("preserves the source-confirmed H/J product codes", () => {
    expect(hunts.cases.find((row) => row.case === "H")?.super.part).toBe("JJM23");
    expect(hunts.cases.find((row) => row.case === "J")?.super.part).toBe("JJM22");
  });

  it("requires the vehicle symbol, not only the supporting card symbol, for a regular TH", () => {
    const regular = {
      ...ferrari,
      identification: {
        ...ferrari.identification,
        casting: "’87 Buick Regal GNX",
        tooling: "’87 Buick Regal GNX",
        releaseYear: 2026,
        line: "Mainline",
        seriesOrMix: "Nightspeed / case A",
        collectorNumber: "9/250",
        productCode: "JJM00",
        wheelType: "PR5",
        cardType: "US long card",
        region: "US",
        colorOrLivery: "Purple",
        chaseStatus: "regular_th" as const,
        chaseMarkersObserved: ["circle_flame_card_symbol" as const],
      },
    };
    expect(findChaseReference(regular.identification).match).toBe("exact_product_code");
    expect(chaseVerification(regular).verified).toBe(false);
    expect(exactReleaseGate(regular).ready).toBe(false);
    expect(chaseVerification({
      ...regular,
      identification: { ...regular.identification, chaseMarkersObserved: ["low_production_vehicle_symbol"] },
    }).verified).toBe(true);
  });

  it("fails chase verification closed after a governed source expires", () => {
    const identification = {
      ...ferrari.identification,
      casting: "’87 Buick Regal GNX",
      tooling: "’87 Buick Regal GNX",
      releaseYear: 2026,
      line: "Mainline",
      seriesOrMix: "Nightspeed / case A",
      collectorNumber: "9/250",
      productCode: "JJM00",
      wheelType: "PR5",
      cardType: "US long card",
      region: "US",
      colorOrLivery: "Purple",
      chaseStatus: "regular_th" as const,
      chaseMarkersObserved: ["low_production_vehicle_symbol" as const],
    };
    const afterExpiry = new Date("2026-09-05T00:00:00Z");
    expect(findChaseReference(identification, afterExpiry).match).toBe("source_expired");
    expect(chaseVerification({ ...ferrari, identification }, afterExpiry).verified).toBe(false);
  });

  it("cross-checks the year and casting associated with a product code", () => {
    const base = {
      ...ferrari.identification,
      productCode: "JJM00",
      releaseYear: 2026,
      casting: "’87 Buick Regal GNX",
      chaseStatus: "regular_th" as const,
    };
    expect(findChaseReference({ ...base, releaseYear: 2025 }).match).not.toBe("exact_product_code");
    expect(findChaseReference({ ...base, casting: "Wrong casting" }).match).not.toBe("exact_product_code");
  });
});

