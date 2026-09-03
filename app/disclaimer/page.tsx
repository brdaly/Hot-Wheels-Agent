import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer | Hot Wheels Collector Intelligence",
  description: "Important limitations for automated collectible identification and market-evidence guidance.",
};

export default function DisclaimerPage() {
  return (
    <>
      <a className="skip-link" href="#primary-content">Skip to disclaimer</a>
      <main id="primary-content" className="legal-page" tabIndex={-1}>
        <Link className="legal-back" href="/">← Back to Collector Intelligence</Link>
        <article className="data-section">
          <p className="eyebrow">INDEPENDENT COLLECTOR TOOL · BETA</p>
          <h1>Disclaimer</h1>
          <p className="legal-lede">
            Hot Wheels Collector Intelligence is an independent Daly Ventures project. It is not affiliated with,
            endorsed by, or sponsored by Mattel, Inc. Hot Wheels® and related trademarks, names, packaging, and
            product rights are owned or controlled by Mattel, Inc. and its licensors.
          </p>

          <section>
            <h2>Informational estimates, not appraisals</h2>
            <p>
              Results are automated decision support for identification, collection fit, visible condition, and price
              discipline. They are not professional appraisals, guarantees of authenticity, investment advice, or
              forecasts of value or return. Do not rely on the application as the sole basis for a purchase, sale,
              insurance decision, or other high-value transaction.
            </p>
          </section>

          <section>
            <h2>Accuracy and verification</h2>
            <p>
              Accuracy depends on photo quality, visible package and base details, catalog coverage, and the freshness
              of cited sources. Rare, altered, mislabeled, future-year, and visually similar releases can be
              misidentified. An unconfirmed result is a prompt to inspect the physical item—not permission to guess.
              Verify exact releases and high-value claims against the item and an authoritative current source.
            </p>
          </section>

          <section>
            <h2>Market evidence</h2>
            <p>
              Retail benchmarks are reference points, not secondary-market valuations. Active asking prices, guide
              prices, affiliate prices, and near-match listings are not treated as completed sales. When authorized,
              exact, comparable completed-sale evidence is unavailable, the Market Evidence grade remains
              insufficient rather than being inferred from asking prices.
            </p>
          </section>

          <section>
            <h2>External sources and images</h2>
            <p>
              Links to Mattel, retailers, HWtreasure, Orange Track Diecast, and other publishers are provided for
              attribution and independent verification. Individual photographs and catalog materials may be separately
              copyrighted by the credited photographer or publisher. Daly Ventures claims no ownership in those
              materials. A link or attribution does not itself transfer image rights, grant permission, or imply
              endorsement. This early prototype remotely displays attributed publisher images from their original host
              and links to the credited source. Written permission will be sought before broader or commercial use.
            </p>
          </section>

          <p className="legal-note">
            Always inspect the actual car and packaging. For a potentially valuable or disputed item, use an
            experienced specialist and independent transaction evidence.
          </p>
        </article>
      </main>
    </>
  );
}
