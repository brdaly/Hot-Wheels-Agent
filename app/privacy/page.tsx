import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | Hot Wheels Collector Intelligence",
  description: "How the Hot Wheels Collector Intelligence beta handles photos, analysis results, and owner access.",
};

export default function PrivacyPage() {
  return (
    <>
      <a className="skip-link" href="#primary-content">Skip to privacy information</a>
      <main id="primary-content" className="legal-page" tabIndex={-1}>
        <Link className="legal-back" href="/">← Back to Collector Intelligence</Link>
        <article className="data-section">
          <p className="eyebrow">PRIVACY · BETA</p>
          <h1>Photo and data handling</h1>
          <p className="legal-lede">
            The public rules demo uses fixed application data. It does not upload a visitor&apos;s photos or call the
            vision model. Photo analysis and private collection records are limited to the authenticated owner
            workspace.
          </p>

          <section>
            <h2>Photos</h2>
            <p>
              When the owner submits a photo, the application decodes, reorients, resizes, and re-encodes it before
              analysis. This removes embedded metadata from the processed image. The application does not intentionally
              save the original photo, and provider storage is disabled for the model request. Provider account-level
              safety and retention rules may still apply and should be reviewed by the operator.
            </p>
          </section>

          <section>
            <h2>Analysis records</h2>
            <p>
              Saving structured analysis results is off by default. If the operator explicitly enables persistence,
              structured results—not raw photo files—expire after 30 days by default. Operational usage records are
              separated from photo content and have their own documented retention schedule.
            </p>
          </section>

          <section>
            <h2>Owner access</h2>
            <p>
              Authentication uses a short-lived, secure, HTTP-only session cookie. Collection data is owner-scoped and
              protected by row-level access rules. The public demo does not create a collection record or expose owner
              analysis history.
            </p>
          </section>

          <section>
            <h2>Reference media</h2>
            <p>
              A source URL is not treated as permission to copy an image. Media is eligible for display only after its
              rights holder, permission or license evidence, permitted transformations, attribution requirements, and
              review status have been recorded. Expired, revoked, or unapproved media fails closed to a placeholder.
            </p>
          </section>

          <section>
            <h2>Questions and changes</h2>
            <p>
              This policy describes the current beta implementation and will be updated when collection, retention, or
              public-access behavior changes. Privacy questions can be sent through the contact route on the
              <a href="https://dalyventures.com" target="_blank" rel="noreferrer"> Daly Ventures website</a>.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
