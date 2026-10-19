import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The privacy notice is the only page on the deployed site that tells a visitor
 * what the application does with their data, so it is the one document whose
 * drift is visible to the public rather than to a reader of the repository.
 *
 * It had drifted in both directions at once: it warned about a publisher image
 * request that the link-only media change had already removed, and said nothing
 * about the analytics beacon that fires on every route. These assertions tie
 * each claim to the code that makes it true.
 */

const privacy = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const csp = /"Content-Security-Policy", value: "([^"]+)"/.exec(nextConfig)?.[1] ?? "";

describe("the privacy notice matches what the application does", () => {
  it("discloses analytics whenever the layout loads it", () => {
    const loadsAnalytics = /<Analytics\s*\/>/.test(layout);
    expect(loadsAnalytics, "layout should load analytics or this test should be rewritten").toBe(true);
    expect(privacy).toMatch(/<h2>Analytics<\/h2>/);
    expect(privacy).toMatch(/va\.vercel-scripts\.com/);
    expect(privacy).toMatch(/va\.vercel-analytics\.com/);
  });

  it("names in the notice every third-party host the policy admits", () => {
    const hosts = [...csp.matchAll(/https:\/\/([a-z0-9.-]+)/gu)].map((m) => m[1]);
    expect(hosts.length).toBeGreaterThan(0);
    for (const host of new Set(hosts)) {
      expect(privacy, `${host} is allowed by the CSP but not disclosed in the privacy notice`).toContain(host);
    }
  });

  it("does not claim a publisher image request while the policy forbids one", () => {
    const imgSrc = /img-src ([^;]+)/.exec(csp)?.[1] ?? "";
    // Only self/blob/data — no external image host can load, so no publisher
    // request happens and the notice must not say one does.
    expect(imgSrc).not.toMatch(/https?:/);
    expect(privacy).not.toMatch(/requested directly from the credited publisher/);
    expect(privacy).not.toMatch(/publisher may receive the visitor/);
    expect(privacy).toMatch(/locally hosted placeholder/);
  });
});
