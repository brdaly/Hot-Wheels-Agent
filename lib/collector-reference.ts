import hunts from "../data/hunt-map-2026.json";
import type { CarObservation, ChaseStatusSchema, Identification } from "./analysis-schema";
import { findSourceByUrl, sourceMaySupport } from "./source-registry";
import type { z } from "zod";

type ChaseStatus = z.infer<typeof ChaseStatusSchema>;

export const COLLECTOR_REFERENCE_VERSION = "collector-reference-2026-08-28";

const SOURCES = [
  {
    name: "HWtreasure Treasure Hunt Checklist",
    url: "https://www.hwtreasure.com/treasure-hunt-checklist/",
    retrievedAt: "2026-08-28",
    use: "Cross-check annual regular and Super Treasure Hunt names; visible markers still required.",
  },
  {
    name: "Orange Track Diecast 2026 Master List",
    url: "https://orangetrackdiecast.com/2026-hot-wheels-master-list-of-all-lines/",
    retrievedAt: "2026-08-28",
    use: "Cross-check line, mix, collector number and chase placement; starred or incomplete entries remain provisional.",
  },
] as const;

const normalize = (value: string | null | undefined) =>
  (value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");

type HuntEntry = {
  case: string;
  status: "super_th" | "regular_th";
  name: string;
  part: string;
  sourceUrl: string;
};

const entries: HuntEntry[] = hunts.cases.flatMap((row) => [
  { case: row.case, status: "super_th", ...row.super },
  { case: row.case, status: "regular_th", ...row.treasure },
]);

function chaseSourcesAreCurrent(status: Extract<ChaseStatus, "regular_th" | "super_th">, asOf: Date) {
  const checklist = findSourceByUrl(SOURCES[0].url);
  const masterList = findSourceByUrl(SOURCES[1].url);
  const checklistClaim = status === "super_th"
    ? "super_treasure_hunt_candidate"
    : "treasure_hunt_candidate";
  return Boolean(
    checklist &&
    masterList &&
    sourceMaySupport(checklist, checklistClaim, asOf) &&
    sourceMaySupport(masterList, "series_mix_membership", asOf)
  );
}

export function findChaseReference(identification: Identification, asOf = new Date()) {
  const chase = identification.chaseStatus;
  if (!["regular_th", "super_th"].includes(chase)) {
    return { match: "not_applicable" as const, entry: null, sources: SOURCES };
  }
  const status = chase as Extract<ChaseStatus, "regular_th" | "super_th">;
  if (!chaseSourcesAreCurrent(status, asOf)) {
    return { match: "source_expired" as const, entry: null, sources: SOURCES };
  }
  const exact = identification.productCode
    ? entries.find((entry) => normalize(entry.part) === normalize(identification.productCode) && entry.status === status)
    : undefined;
  if (exact) return { match: "exact_product_code" as const, entry: exact, sources: SOURCES };
  const byName = identification.releaseYear === 2026
    ? entries.find((entry) => normalize(entry.name) === normalize(identification.casting) && entry.status === status)
    : undefined;
  return { match: byName ? "casting_year_only" as const : "none" as const, entry: byName ?? null, sources: SOURCES };
}

export function deterministicCaseInference(cars: CarObservation[], asOf = new Date()) {
  const matches = cars.map((car) => findChaseReference(car.identification, asOf))
    .filter((result): result is ReturnType<typeof findChaseReference> & { entry: HuntEntry } => Boolean(result.entry));
  if (matches.length < 2) return null;
  const cases = [...new Set(matches.map((result) => result.entry.case))];
  if (cases.length !== 1) return null;
  return {
    value: `2026 mainline case ${cases[0]}`,
    evidence: matches.map((result) => `${result.entry.name} (${result.entry.part})`),
    sources: SOURCES,
    confidence: matches.every((result) => result.match === "exact_product_code") ? "high" as const : "medium" as const,
  };
}
