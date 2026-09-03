import { describe, expect, it } from "vitest";
import hunts from "../data/hunt-map-2026.json";
import { HUNT_REFERENCE_IMAGES } from "../data/hunt-reference-images";

describe("early-prototype hunt reference images", () => {
  it("maps one attributed photograph to every Chase Grid entry", () => {
    const publicEntries = hunts.cases.flatMap((row) => [row.super, row.treasure]);

    expect(HUNT_REFERENCE_IMAGES).toHaveLength(30);
    expect(new Set(HUNT_REFERENCE_IMAGES.map((image) => image.part)).size).toBe(30);
    expect(HUNT_REFERENCE_IMAGES.map(({ part, name }) => ({ part, name })).sort((a, b) => a.part.localeCompare(b.part)))
      .toEqual(publicEntries.map(({ part, name }) => ({ part, name })).sort((a, b) => a.part.localeCompare(b.part)));

    for (const image of HUNT_REFERENCE_IMAGES) {
      expect(image.sourceUrl).toMatch(/^https:\/\/hwheadline\.com\//);
      expect(image.imageUrl).toMatch(/^https:\/\/storage\.ghost\.io\//);
      expect(image.attribution).toBe("Photo: HWheadline / HWJamey");
    }
  });

  it("keeps the image schedule separate from the governed identification map", () => {
    expect(JSON.stringify(hunts)).not.toContain("imageUrl");
  });
});
