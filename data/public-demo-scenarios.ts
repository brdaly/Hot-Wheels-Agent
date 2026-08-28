export type PublicDemoTone = "ready" | "verify" | "pass";

export type PublicDemoSignal = {
  label: string;
  value: string;
  note: string;
};

export type PublicDemoScenario = {
  id: string;
  pickerLabel: string;
  title: string;
  premise: string;
  outcome: string;
  outcomeSummary: string;
  tone: PublicDemoTone;
  signals: PublicDemoSignal[];
  observed: string[];
  nextChecks: string[];
  lesson: string;
};

/**
 * These are intentionally fictional, precomputed rules scenarios. They illustrate
 * the deterministic decision policy without making an exact-release claim,
 * using a model, uploading a photo, or exposing owner collection data.
 */
export const PUBLIC_DEMO_REVIEWED_ON = "2026-08-28";
export const PUBLIC_DEMO_RULESET = "collection-priority-v3.1";

export const publicDemoScenarios: PublicDemoScenario[] = [
  {
    id: "evidence-aligned",
    pickerLabel: "Evidence aligned",
    title: "Illustrative release A",
    premise: "Four hypothetical views agree on the card, product code, wheels and livery.",
    outcome: "Decision-ready example",
    outcomeSummary: "The exact-release fields align, so collection fit, condition and price can be considered independently.",
    tone: "ready",
    signals: [
      { label: "Collection fit", value: "82/100 · A", note: "Sample collector profile" },
      { label: "Identity evidence", value: "High · aligned", note: "Exact fields present" },
      { label: "Condition gate", value: "Pass", note: "No blocking defect in the scenario" },
      { label: "Market evidence", value: "Grade U", note: "No resale claim is made" },
    ],
    observed: [
      "Front and back product codes agree.",
      "Wheel design and livery match the candidate description.",
      "Card and blister are clear enough for a condition check.",
    ],
    nextChecks: ["Confirm the physical item before purchase; this scenario is not an exact product record."],
    lesson: "A high score becomes actionable only after identity evidence clears the verification gate.",
  },
  {
    id: "verify-first",
    pickerLabel: "Verify first",
    title: "Illustrative release B",
    premise: "The casting looks promising, but the base code is unreadable and the claimed chase marker is not visible.",
    outcome: "No buy call yet",
    outcomeSummary: "A strong collection-fit score cannot override missing exact-release or chase evidence.",
    tone: "verify",
    signals: [
      { label: "Collection fit", value: "88/100 · A+", note: "Visible for comparison only" },
      { label: "Identity evidence", value: "Medium · incomplete", note: "Product code unresolved" },
      { label: "Condition gate", value: "Verify", note: "Blister edge is not shown" },
      { label: "Market evidence", value: "Grade U", note: "No exact sold evidence supplied" },
    ],
    observed: [
      "Casting shape and livery support a plausible candidate.",
      "The image does not prove the exact colorway or package release.",
    ],
    nextChecks: [
      "Photograph the base or package product code.",
      "Confirm the required chase marker and wheel type.",
      "Add a clear blister-edge view before grading condition.",
    ],
    lesson: "Verify first is a blocking state, not a softer recommendation.",
  },
  {
    id: "price-gate",
    pickerLabel: "Price gate",
    title: "Illustrative release C",
    premise: "Identity is sufficiently clear, but the hypothetical shelf price sits well above the example retail reference.",
    outcome: "Pass at this price",
    outcomeSummary: "Collection desirability does not turn an inflated shelf price into a good decision.",
    tone: "pass",
    signals: [
      { label: "Collection fit", value: "76/100 · B+", note: "Selective candidate" },
      { label: "Identity evidence", value: "High · aligned", note: "Scenario fields complete" },
      { label: "Price gate", value: "Above reference", note: "$14.99 observed vs. $6.47 example" },
      { label: "Market evidence", value: "Grade U", note: "Active asks are not sold evidence" },
    ],
    observed: [
      "Identity evidence is sufficient for this hypothetical rule path.",
      "The observed price is more than double the example retail reference.",
    ],
    nextChecks: ["Compare another retailer or wait; do not infer resale upside from an asking price."],
    lesson: "The price gate remains independent from collection fit and market hype.",
  },
];
