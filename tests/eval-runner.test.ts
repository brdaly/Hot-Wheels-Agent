import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const EvalCase = z.object({
  case_id: z.string().regex(/^[a-z0-9-]+$/),
  input_kind: z.enum(["governed_future_fixture", "hard_negative"]),
  scenario: z.string().min(20),
  expected: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  risk: z.string().min(20),
}).strict();

const lines = readFileSync(new URL("../evals/golden-photo-analysis.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map((line) => EvalCase.parse(JSON.parse(line)));

describe("governed evaluation manifest", () => {
  it("has unique stable IDs and meaningful coverage", () => {
    expect(lines.length).toBeGreaterThanOrEqual(7);
    expect(new Set(lines.map((item) => item.case_id)).size).toBe(lines.length);
    expect(lines.filter((item) => item.input_kind === "hard_negative").length).toBeGreaterThanOrEqual(4);
  });

  it("covers the core fail-closed risks", () => {
    const ids = new Set(lines.map((item) => item.case_id));
    for (const id of [
      "ambiguous-crop",
      "regular-th-card-only",
      "black-premium-not-chase",
      "active-asking-price",
      "future-2027-watchlist",
    ]) expect(ids.has(id)).toBe(true);
  });
});
