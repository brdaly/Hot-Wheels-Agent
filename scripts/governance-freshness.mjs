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
import { fileURLToPath, pathToFileURL } from "node:url";
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

  // `approvedMediaFromManifest` rejects an asset on its own rights deadlines,
  // independently of the manifest's. Either can fall first, and when one does
  // the asset silently drops to the placeholder while the manifest still looks
  // current, so reporting only the manifest deadline leaves the job green over
  // media that is already unpublishable.
  const assets = (manifest.assets ?? [])
    // Only assets the media gate would otherwise serve. A revoked, taken-down
    // or withdrawn asset is retained deliberately as an audit record, and
    // `mediaLifecycleStatusSchema` requires `rights.revokedAt` on those states.
    // Reporting its long-past rights deadline flags work that cannot be done:
    // there is no re-review that returns a taken-down asset to currency, so the
    // weekly job would go red and stay red with no way to clear it. Such an
    // asset is already not being served, so nothing is degrading.
    .filter((asset) =>
      asset.lifecycleStatus === "approved"
      && asset.rights?.revokedAt == null
      && asset.rights?.evidenceWithdrawnAt == null
      && asset.rights?.evidenceStatus === "verified")
    .flatMap((asset) => {
      const deadlines = [
        ["rights.expiresAt", asset.rights?.expiresAt],
        ["rights.evidenceExpiresAt", asset.rights?.evidenceExpiresAt],
      ].filter(([, value]) => typeof value === "string" && now >= startOfDay(value));

      return deadlines.map(([field, value]) => ({
        assetId: asset.assetId ?? asset.id ?? "(unidentified asset)",
        releaseId: asset.releaseId ?? null,
        field,
        expiresAt: value,
        daysOverdue: daysBetween(startOfDay(value), now),
      }));
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || a.assetId.localeCompare(b.assetId));

  return { asOf: today, sources, manifest: expiredManifest, assets };
}

/**
 * Renders the report as Markdown, suitable for a job summary or an issue body.
 *
 * @param {ReturnType<typeof collectExpired>} expired
 * @returns {string}
 */
export function formatReport(expired) {
  const lines = [];
  const total = expired.sources.length + (expired.manifest ? 1 : 0) + expired.assets.length;

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

  if (expired.assets.length > 0) {
    lines.push(`### Asset rights (${expired.assets.length} past deadline)`);
    lines.push("");
    lines.push("| Asset | Release | Field | Expired | Days overdue |");
    lines.push("|---|---|---|---|---|");
    for (const asset of expired.assets) {
      lines.push(
        `| \`${asset.assetId}\` | ${asset.releaseId ?? "—"} | \`${asset.field}\` | ${asset.expiresAt} | ${asset.daysOverdue} |`,
      );
    }
    lines.push("");
    lines.push(
      "These fall independently of the manifest deadline. Each asset above is",
      "already refused by `approvedMediaFromManifest` and is serving the local",
      "placeholder, whatever the manifest's own review date says.",
      "",
    );
  }

  lines.push("### To clear this");
  lines.push("");

  // Only the steps that apply. When the manifest or an asset is the sole
  // expired input, source-page instructions are not merely noise: they are the
  // whole of the remediation, and they name fields the manifest does not have.
  let step = 1;
  if (expired.sources.length > 0) {
    lines.push(
      `${step++}. Open each source page above and re-verify the facts the entry claims to support.`,
      `${step++}. Update \`retrievedOn\` and \`freshness.expiresOn\` to reflect that reading. Change`,
      "   `sourceModifiedOn` only if the page itself shows a new modification date; where the",
      "   publisher shows none it stays `null`, because inventing one fabricates provenance.",
      `${step++}. If the cadence is not sustainable, raise \`cadenceDays\` and say why in`,
      "   `freshness.basis`, rather than repeatedly pushing the date forward.",
    );
  }
  if (expired.manifest) {
    lines.push(
      `${step++}. Re-review \`data/media-manifest.json\`: confirm every asset's rights, evidence and`,
      "   territory still hold, then set `reviewedAt` to that review and `expiresAt` to the next",
      "   deadline you will actually honour. The schema requires `expiresAt` to be after",
      "   `reviewedAt`.",
    );
  }
  if (expired.assets.length > 0) {
    lines.push(
      `${step++}. For each asset above, re-confirm the permission behind it with the rights holder`,
      "   and record a new evidence version, then update the named field. Do not extend a",
      "   rights or evidence deadline without fresh evidence: the migration requires a",
      "   different evidence reference verified after the last approval.",
    );
  }
  lines.push(
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

  const total = expired.sources.length + (expired.manifest ? 1 : 0) + expired.assets.length;
  process.exitCode = total === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
