#!/usr/bin/env node
/**
 * Reports which governed inputs are past their re-review date.
 *
 * The catalog and the media manifest are fail-closed controls: when an entry
 * expires, `sourceFreshness` returns "expired" and `findChaseReference` answers
 * `source_expired` instead of an exact product code, and the media manifest
 * stops releasing any asset. That is the designed behaviour, but on its own it
 * is silent — the weekly job went red and said only that a test had failed.
 *
 * This turns the same state into something a person can act on: what expired,
 * how long ago, what it is used for, and what re-review each entry needs.
 *
 * Usage:
 *   node scripts/governance-freshness.mjs [--as-of YYYY-MM-DD] [--report PATH]
 *
 * Exits 1 when anything is expired, 0 otherwise.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {string} value @returns {number} */
function startOfDay(value) {
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed)) throw new RangeError(`Not a date: ${value}`);
  return parsed;
}

/** @param {number} from @param {number} to @returns {number} */
function daysBetween(from, to) {
  return Math.floor((to - from) / DAY_MS);
}

/**
 * Collects every governed input whose re-review date has passed.
 *
 * A source expires at the end of its `expiresOn` day, matching
 * `sourceFreshness`, which compares whole dates. The media manifest expires at
 * the instant of its `expiresAt`, matching `approvedMediaFromManifest`.
 *
 * @param {{sources: ReadonlyArray<Record<string, any>>}} catalog
 * @param {Record<string, any>} manifest
 * @param {Date} asOf
 * @returns {{asOf: string, sources: Array<Record<string, any>>, manifest: Record<string, any> | null}}
 */
export function collectExpired(catalog, manifest, asOf) {
  const now = asOf.getTime();
  if (Number.isNaN(now)) throw new RangeError("asOf must be a valid date");
  const today = asOf.toISOString().slice(0, 10);

  const sources = catalog.sources
    .filter((source) => today > source.freshness.expiresOn)
    .map((source) => ({
      id: source.id,
      publisher: source.publisher,
      url: source.url,
      purpose: source.purpose,
      expiresOn: source.freshness.expiresOn,
      cadenceDays: source.freshness.cadenceDays,
      basis: source.freshness.basis,
      daysOverdue: daysBetween(startOfDay(source.freshness.expiresOn), startOfDay(today)),
      supportedClaims: source.supportedClaims ?? [],
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue || a.id.localeCompare(b.id));

  const manifestExpiresAt = startOfDay(manifest.expiresAt);
  const expiredManifest = now >= manifestExpiresAt
    ? {
        reviewedAt: manifest.reviewedAt,
        expiresAt: manifest.expiresAt,
        assetCount: manifest.assets.length,
        daysOverdue: daysBetween(manifestExpiresAt, now),
      }
    : null;

  return { asOf: today, sources, manifest: expiredManifest };
}

/**
 * Renders the report as Markdown, suitable for a job summary or an issue body.
 *
 * @param {ReturnType<typeof collectExpired>} expired
 * @returns {string}
 */
export function formatReport(expired) {
  const lines = [];
  const total = expired.sources.length + (expired.manifest ? 1 : 0);

  if (total === 0) {
    lines.push(`Every governed source and the media manifest are within their re-review window as of ${expired.asOf}.`);
    return `${lines.join("\n")}\n`;
  }

  lines.push(`## Governed inputs past re-review as of ${expired.asOf}`);
  lines.push("");
  lines.push(
    "These are fail-closed controls, so the application is already degrading:",
    "an expired catalog entry makes `findChaseReference` answer `source_expired`",
    "instead of an exact product code, and an expired media manifest releases no",
    "assets at all. Re-dating without re-reading the page turns the control into a",
    "rubber stamp, so each entry below needs its facts re-verified at the source.",
    "",
  );

  if (expired.sources.length > 0) {
    lines.push(`### Source catalog (${expired.sources.length} expired)`);
    lines.push("");
    lines.push("| Source | Expired | Days overdue | Cadence | Page |");
    lines.push("|---|---|---|---|---|");
    for (const source of expired.sources) {
      lines.push(
        `| \`${source.id}\` | ${source.expiresOn} | ${source.daysOverdue} | ${source.cadenceDays}d | <${source.url}> |`,
      );
    }
    lines.push("");
    for (const source of expired.sources) {
      lines.push(`- **\`${source.id}\`** — ${source.purpose}`);
      lines.push(`  - Re-review basis: ${source.basis}`);
      lines.push(`  - Supports: ${source.supportedClaims.join(", ") || "no claims recorded"}`);
    }
    lines.push("");
  }

  if (expired.manifest) {
    lines.push("### Media manifest");
    lines.push("");
    lines.push(
      `\`data/media-manifest.json\` expired ${expired.manifest.expiresAt} (${expired.manifest.daysOverdue} days overdue, reviewed ${expired.manifest.reviewedAt}, ${expired.manifest.assetCount} assets).`,
      "While it is expired `approvedMediaFromManifest` returns nothing, so every",
      "reference image falls back to the local placeholder.",
      "",
    );
  }

  lines.push("### To clear this");
  lines.push("");
  lines.push(
    "1. Open each page above and re-verify the facts the entry claims to support.",
    "2. Update `retrievedOn`, `sourceModifiedOn` and `freshness.expiresOn` to reflect that reading.",
    "3. If a weekly cadence is not sustainable, raise `cadenceDays` and say why in `freshness.basis`,",
    "   rather than repeatedly pushing the date forward.",
    "",
    "_Opened automatically by the source review workflow._",
  );

  return `${lines.join("\n")}\n`;
}

async function main(argv) {
  const asOfArg = argv[argv.indexOf("--as-of") + 1];
  const reportArg = argv.includes("--report") ? argv[argv.indexOf("--report") + 1] : null;
  const asOf = argv.includes("--as-of") ? new Date(`${asOfArg}T00:00:00.000Z`) : new Date();

  const [catalog, manifest] = await Promise.all([
    readFile(path.join(ROOT, "data/source-catalog.json"), "utf8").then(JSON.parse),
    readFile(path.join(ROOT, "data/media-manifest.json"), "utf8").then(JSON.parse),
  ]);

  const expired = collectExpired(catalog, manifest, asOf);
  const report = formatReport(expired);

  process.stdout.write(report);
  if (reportArg) await writeFile(path.join(process.cwd(), reportArg), report, "utf8");

  const total = expired.sources.length + (expired.manifest ? 1 : 0);
  process.exitCode = total === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  await main(process.argv.slice(2));
}
