"use client";

/* eslint-disable @next/next/no-img-element -- object URLs are local, transient previews */
import { FormEvent, useEffect, useMemo, useState } from "react";
import hunts from "@/data/hunt-map-2026.json";
import retail from "@/data/us-retail-2026-08-27.json";

type Result = {
  traceId: string;
  evaluationId: string | null;
  persistenceWarning?: string | null;
  cars: Array<{
    rank: number;
    observationId: string;
    identification: {
      casting: string;
      brand: string;
      releaseYear: number | null;
      line: string;
      chaseStatus: string;
      confidence: string;
    };
    score: { total: number; tier: string; components: Record<string, number> };
    marketEvidenceGrade: string;
    condition: { grade: string };
    recommendation: {
      decision: string;
      packaging: string;
      conditionGate: { status: string; label: string };
    };
    priceGate: { verdict: string; note: string };
    verificationNeeded: string[];
  }>;
  scene: { caseOrMixInference: string | null; inferenceEvidence: string[] };
  proactiveTargets: Array<{
    name: string;
    reason: string;
    visualMarkers: string[];
    confidence: string;
  }>;
  limitations: string[];
};

type Tab = "analyze" | "hunts" | "market";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("analyze");
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(
    () => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)),
    [previews],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!files.length) return;

    setBusy(true);
    setError("");
    setResult(null);

    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    form.set("market", "US");
    form.set("currency", "USD");
    if (price) form.set("observedPrice", price);

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) {
        const trace = body.traceId ? ` Trace: ${body.traceId}` : "";
        throw new Error(`${body.error ?? "Analysis failed"}${trace}`);
      }
      setResult(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <nav>
        <a className="brand" href="#top"><span>DV</span> Daly Ventures</a>
        <div className="navlinks" aria-label="Product sections">
          <button type="button" onClick={() => setTab("analyze")} className={tab === "analyze" ? "active" : ""}>Analyst</button>
          <button type="button" onClick={() => setTab("hunts")} className={tab === "hunts" ? "active" : ""}>Hunt Map</button>
          <button type="button" onClick={() => setTab("market")} className={tab === "market" ? "active" : ""}>US Retail</button>
        </div>
        <a className="site-link" href="https://dalyventures.com/" target="_blank" rel="noreferrer">DalyVentures.com ↗</a>
      </nav>

      <header id="top">
        <div>
          <p className="eyebrow">HOT WHEELS SUPER ANALYST · MODEL V2.1</p>
          <h1>See the car.<br/><em>Know the move.</em></h1>
          <p className="lede">Exact-release identification, transparent scoring, US price discipline and proactive hunt intelligence for every peg wall and collection decision.</p>
        </div>
        <div className="signal"><span>DECISION SYSTEM</span><strong>4</strong><p>separate decision gates</p><small>Priority · Evidence · Condition · Price</small></div>
      </header>

      {tab === "analyze" && (
        <>
          <section className="workbench">
            <div className="section-head">
              <div><p className="eyebrow">01 · ANALYZE</p><h2>Upload the evidence</h2></div>
              <p>Use a full card front, back, chase-marker close-up or peg-wall photo. Up to four images.</p>
            </div>
            <form onSubmit={submit}>
              <label className="drop">
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))}/>
                {previews.length ? (
                  <div className="previews">{previews.map(({ file, url }) => <img key={`${file.name}-${file.lastModified}`} src={url} alt="Selected Hot Wheels evidence"/>)}</div>
                ) : (
                  <><b>Drop car photos here</b><span>JPEG, PNG or WebP · 10 MB each</span></>
                )}
              </label>
              <div className="controls">
                <div className="market-lock"><span>Buyer market</span><b>United States · USD</b></div>
                <label>Shelf price (USD)<input inputMode="decimal" placeholder="Optional" value={price} onChange={(event) => setPrice(event.target.value)}/></label>
                <button className="primary" disabled={busy || !files.length}>{busy ? "Running evidence pipeline…" : "Analyze & rank"}</button>
              </div>
            </form>
            {error && <p className="error">{error}</p>}
          </section>

          {!result && (
            <section className="method-grid">
              <article><span>01</span><h3>Identify</h3><p>Exact casting, release, line, livery and visible chase markers—with confidence.</p></article>
              <article><span>02</span><h3>Score</h3><p>Seven bounded components totaled deterministically in application code.</p></article>
              <article><span>03</span><h3>Gate</h3><p>Market evidence, condition and US retail price remain separate from taste.</p></article>
              <article><span>04</span><h3>Hunt</h3><p>Nearby cars become case intelligence and proactive search targets.</p></article>
            </section>
          )}

          {result && (
            <section className="results">
              <div className="section-head">
                <div><p className="eyebrow">02 · RANKED RESULT</p><h2>{result.cars.length} visible {result.cars.length === 1 ? "car" : "cars"}</h2></div>
                {result.scene.caseOrMixInference && <div className="case-call"><span>CASE SIGNAL</span><b>{result.scene.caseOrMixInference}</b></div>}
              </div>
              {result.persistenceWarning && <p className="warning">{result.persistenceWarning}</p>}
              {result.cars.map((car) => (
                <article className="car" key={car.observationId}>
                  <div className="rank">#{car.rank}</div>
                  <div className="score"><strong>{car.score.total}</strong><span>{car.score.tier}</span></div>
                  <div className="car-main">
                    <p className="eyebrow">{car.identification.confidence} confidence · {car.identification.chaseStatus.replaceAll("_", " ")}</p>
                    <h3>{car.identification.casting}</h3>
                    <p>{car.identification.releaseYear ?? "Year unresolved"} · {car.identification.line}</p>
                    <div className="badges">
                      <span>{car.recommendation.decision}</span><span>Evidence {car.marketEvidenceGrade}</span>
                      <span className={car.recommendation.conditionGate.status}>{car.condition.grade} condition</span>
                      <span className={car.priceGate.verdict}>{car.priceGate.verdict.replaceAll("_", " ")}</span>
                    </div>
                    <p className="verdict"><b>{car.recommendation.packaging}.</b> {car.priceGate.note}</p>
                    {car.verificationNeeded.length > 0 && <details><summary>Verification queue · {car.verificationNeeded.length}</summary><ul>{car.verificationNeeded.map((item) => <li key={item}>{item}</li>)}</ul></details>}
                  </div>
                </article>
              ))}
              {result.proactiveTargets.length > 0 && (
                <div className="hunt-box"><p className="eyebrow">PROACTIVE HUNT</p><h2>Search the pegs for</h2><div className="target-grid">
                  {result.proactiveTargets.map((target) => <article key={target.name}><b>{target.name}</b><p>{target.reason}</p><small>{target.visualMarkers.join(" · ")}</small></article>)}
                </div></div>
              )}
              <p className="trace">Trace {result.traceId}{result.evaluationId ? ` · Saved ${result.evaluationId}` : ""}</p>
            </section>
          )}
        </>
      )}

      {tab === "hunts" && (
        <section className="data-section">
          <div className="section-head"><div><p className="eyebrow">2026 CASE INTELLIGENCE</p><h2>Treasure Hunt map</h2></div><p>Super Treasure Hunt and regular Treasure Hunt targets by mainline case. Verify exact visual markers before buying.</p></div>
          <div className="hunt-table">
            <div className="hunt-row header"><span>Case</span><span>Super Treasure Hunt</span><span>Treasure Hunt</span></div>
            {hunts.cases.map((item) => <div className="hunt-row" key={item.case}><b>{item.case}</b><span>{item.super}</span><span>{item.treasure}</span></div>)}
          </div>
        </section>
      )}

      {tab === "market" && (
        <section className="data-section">
          <div className="section-head"><div><p className="eyebrow">UNITED STATES · {retail.asOf}</p><h2>US retail gates</h2></div><p>Current first-party benchmarks. These guide shelf-price discipline; they are not secondary-market valuations.</p></div>
          <div className="price-grid">
            {retail.benchmarks.map((row) => (
              <article key={row.category}><small>{row.category.replaceAll("_", " ")}</small><strong>${row.normalPrice.toFixed(2)}</strong><p>{row.retailer}</p><span>Strong ≤ ${row.strongBuyAtOrBelow.toFixed(2)}</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></article>
            ))}
          </div>
          <div className="notes">{retail.notes.map((note) => <p key={note}>↳ {note}</p>)}</div>
        </section>
      )}

      <footer>
        <div><b>Hot Wheels Super Analyst</b><p>Collection intelligence, not a return forecast. Exact releases and high-value claims require verification.</p></div>
        <div><a href="https://orangetrackdiecast.com/hot-wheels-casting-database/" target="_blank" rel="noreferrer">Orange Track Database ↗</a><a href="https://www.hwtreasure.com/" target="_blank" rel="noreferrer">HWtreasure ↗</a></div>
        <small>A Daly Ventures project · Independent and not affiliated with Mattel</small>
      </footer>
    </main>
  );
}
