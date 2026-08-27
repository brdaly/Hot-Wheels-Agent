"use client";

/* eslint-disable @next/next/no-img-element -- remote release references and local object URLs are intentional */
import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import carSuggestions from "@/data/car-search-index.json";
import hunts from "@/data/hunt-map-2026.json";
import retail from "@/data/us-retail-2026-08-27.json";

type Result = {
  traceId: string;
  evaluationId: string | null;
  persistenceWarning?: string | null;
  cars: Array<{
    rank: number;
    observationId: string;
    identification: { casting: string; brand: string; releaseYear: number | null; line: string; chaseStatus: string; confidence: string };
    score: { total: number; tier: string; components: Record<string, number> };
    marketEvidenceGrade: string;
    condition: { grade: string };
    recommendation: { decision: string; packaging: string; conditionGate: { status: string; label: string } };
    priceGate: { verdict: string; note: string };
    verificationNeeded: string[];
  }>;
  scene: { caseOrMixInference: string | null; inferenceEvidence: string[] };
  proactiveTargets: Array<{ name: string; reason: string; visualMarkers: string[]; confidence: string }>;
  limitations: string[];
};

type Tab = "analyze" | "hunts" | "market";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("analyze");
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const ready = files.length > 0 || query.trim().length >= 2;

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

  function addFiles(next: File[]) {
    setFiles((current) => [...current, ...next.filter((file) => file.type.startsWith("image/"))].slice(0, 4));
    setError("");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    setResult(null);
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    form.set("query", query.trim());
    form.set("market", "US");
    form.set("currency", "USD");
    if (price) form.set("observedPrice", price);
    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(`${body.error ?? "Analysis failed"}${body.traceId ? ` Trace: ${body.traceId}` : ""}`);
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
        <a className="brand" href="#top" aria-label="Daly Ventures Hot Wheels Analyst"><img src="/daly-ventures-logo.svg" alt="Daly Ventures"/><b>Collector Intelligence</b></a>
        <div className="navlinks" aria-label="Product sections">
          <button type="button" onClick={() => setTab("analyze")} className={tab === "analyze" ? "active" : ""}>Analyst</button>
          <button type="button" onClick={() => setTab("hunts")} className={tab === "hunts" ? "active" : ""}>Chase Grid</button>
          <button type="button" onClick={() => setTab("market")} className={tab === "market" ? "active" : ""}>US Retail</button>
        </div>
        <a className="site-link" href="https://dalyventures.com/" target="_blank" rel="noreferrer">DalyVentures.com ↗</a>
      </nav>

      <header id="top">
        <div>
          <p className="eyebrow">DALY VENTURES · COLLECTOR INTELLIGENCE</p>
          <h1>Built for<br/>the hunt.<br/><em>Ready for the shelf.</em></h1>
          <p className="lede">Turn a peg-wall photo or casting name into an exact-release score, a disciplined buy call and the next cars worth finding.</p>
        </div>
        <div className="signal"><span>CHASE MODE · 2026</span><strong>30</strong><p>TH + STH targets indexed</p><small>Every case · visual field guide</small></div>
      </header>

      {tab === "analyze" && (
        <>
          <section className="workbench">
            <div className="section-head">
              <div><p className="eyebrow">01 · START YOUR SCAN</p><h2>Shoot it. Search it. Score it.</h2></div>
              <p>Use the full card when possible. Add the back, chase marker or peg wall for sharper exact-release confidence.</p>
            </div>
            <form onSubmit={submit}>
              <div className="entry-grid">
                <label className="entry-option camera"><span className="entry-icon">◎</span><b>Take a photo</b><small>Open your rear camera</small><input type="file" accept="image/*" capture="environment" onChange={(event) => addFiles(Array.from(event.target.files ?? []))}/></label>
                <label className="entry-option gallery"><span className="entry-icon">▧</span><b>Choose photos</b><small>Front, back or peg wall</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => addFiles(Array.from(event.target.files ?? []))}/></label>
                <label className="entry-option search"><span className="entry-icon">⌕</span><b>Type the car name</b><small>Autocomplete includes current targets</small><input list="car-suggestions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Ferrari F40 Competizione" autoComplete="off"/></label>
                <datalist id="car-suggestions">{carSuggestions.map((car) => <option value={car} key={car}/>)}</datalist>
              </div>

              <div className={`evidence-stage ${previews.length ? "has-files" : ""}`} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
                {previews.length ? (
                  <div className="previews">{previews.map(({ file, url }, index) => <figure key={`${file.name}-${file.lastModified}-${index}`}><img src={url} alt={`Selected evidence ${index + 1}`}/><button type="button" onClick={() => removeFile(index)} aria-label={`Remove image ${index + 1}`}>×</button></figure>)}</div>
                ) : (
                  <><b>Drop collector evidence here</b><span>Or use camera, gallery or car-name search above</span></>
                )}
              </div>

              <div className="controls">
                <div className="market-lock"><span>Buyer market</span><b>United States · USD</b></div>
                <label>Shelf price (USD)<input inputMode="decimal" placeholder="Optional" value={price} onChange={(event) => setPrice(event.target.value)}/></label>
                <button className="primary" disabled={busy || !ready}>{busy ? "Running collector analysis…" : "Run collector analysis"}</button>
              </div>
              <p className="entry-note">No photo? Name-only searches are supported, but exact colorway, chase status and package condition will remain verification gates.</p>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
          </section>

          {!result && (
            <section className="method-grid">
              <article><span>01</span><h3>Spot</h3><p>Read the casting, card, wheels, livery and visible chase marks.</p></article>
              <article><span>02</span><h3>Verify</h3><p>Separate exact evidence from look-alikes, hype and incomplete IDs.</p></article>
              <article><span>03</span><h3>Score</h3><p>Rank collection fit while keeping price and condition independent.</p></article>
              <article><span>04</span><h3>Hunt next</h3><p>Turn nearby releases into case intelligence and the next peg target.</p></article>
            </section>
          )}

          {result && (
            <section className="results">
              <div className="section-head">
                <div><p className="eyebrow">02 · COLLECTOR VERDICT</p><h2>{result.cars.length} {result.cars.length === 1 ? "release" : "releases"} ranked</h2></div>
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
                    <div className="badges"><span>{car.recommendation.decision}</span><span>Evidence {car.marketEvidenceGrade}</span><span className={car.recommendation.conditionGate.status}>{car.condition.grade} condition</span><span className={car.priceGate.verdict}>{car.priceGate.verdict.replaceAll("_", " ")}</span></div>
                    <p className="verdict"><b>{car.recommendation.packaging}.</b> {car.priceGate.note}</p>
                    {car.verificationNeeded.length > 0 && <details><summary>Verification queue · {car.verificationNeeded.length}</summary><ul>{car.verificationNeeded.map((item) => <li key={item}>{item}</li>)}</ul></details>}
                  </div>
                </article>
              ))}
              {result.proactiveTargets.length > 0 && <div className="hunt-box"><p className="eyebrow">YOUR NEXT PEG TARGETS</p><h2>Keep hunting for</h2><div className="target-grid">{result.proactiveTargets.map((target) => <article key={target.name}><b>{target.name}</b><p>{target.reason}</p><small>{target.visualMarkers.join(" · ")}</small></article>)}</div></div>}
              <p className="trace">Trace {result.traceId}{result.evaluationId ? ` · Saved ${result.evaluationId}` : ""}</p>
            </section>
          )}
        </>
      )}

      {tab === "hunts" && (
        <section className="data-section chase-section">
          <div className="section-head"><div><p className="eyebrow">2026 · COMPLETE VISUAL FIELD GUIDE</p><h2>The Chase Grid</h2></div><p>Every Super Treasure Hunt and regular Treasure Hunt, organized by mainline case. Compare paint, wheels and card details before you call the chase.</p></div>
          <div className="hunt-legend"><span><i className="super-dot"/>Super Treasure Hunt</span><span><i className="regular-dot"/>Treasure Hunt</span><small>30 visual targets · updated {hunts.asOf}</small></div>
          <div className="hunt-grid">
            {hunts.cases.map((item) => (
              <article className="hunt-case" key={item.case}>
                <div className="case-label"><span>MAINLINE</span><strong>CASE {item.case}</strong></div>
                {([ ["super", item.super], ["regular", item.treasure] ] as const).map(([kind, car]) => (
                  <a className={`hunt-car ${kind}`} href={car.sourceUrl} target="_blank" rel="noreferrer" key={car.part}>
                    <div className="hunt-image"><img src={`/api/reference-image?src=${encodeURIComponent(car.imageUrl)}`} alt={`${car.name}, 2026 ${kind === "super" ? "Super Treasure Hunt" : "Treasure Hunt"}`} loading="lazy" onError={(event) => { event.currentTarget.src = "/hunt-placeholder.svg"; }}/><span>{kind === "super" ? "SUPER TREASURE HUNT" : "TREASURE HUNT"}</span></div>
                    <div className="hunt-copy"><small>{car.part}</small><h3>{car.name}</h3><p>Open exact-release reference ↗</p></div>
                  </a>
                ))}
              </article>
            ))}
          </div>
          <p className="source-note">Release photography is displayed from <a href={hunts.imageSource.url} target="_blank" rel="noreferrer">{hunts.imageSource.name}</a> with direct attribution. Chase status and case placement should be cross-checked against HWtreasure and Orange Track Diecast.</p>
        </section>
      )}

      {tab === "market" && (
        <section className="data-section">
          <div className="section-head"><div><p className="eyebrow">UNITED STATES · {retail.asOf}</p><h2>US retail gates</h2></div><p>First-party shelf benchmarks for disciplined buying. These are retail reference points—not secondary-market valuations.</p></div>
          <div className="price-grid">{retail.benchmarks.map((row) => <article key={row.category}><small>{row.category.replaceAll("_", " ")}</small><strong>${row.normalPrice.toFixed(2)}</strong><p>{row.retailer}</p><span>Strong buy ≤ ${row.strongBuyAtOrBelow.toFixed(2)}</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">Retail source ↗</a></article>)}</div>
          <div className="notes">{retail.notes.map((note) => <p key={note}>↳ {note}</p>)}</div>
        </section>
      )}

      <footer>
        <div><b>Hot Wheels Super Analyst</b><p>Collector intelligence, not a return forecast. Exact releases and high-value claims require verification.</p></div>
        <div><a href="https://orangetrackdiecast.com/hot-wheels-casting-database/" target="_blank" rel="noreferrer">Orange Track Database ↗</a><a href="https://www.hwtreasure.com/" target="_blank" rel="noreferrer">HWtreasure ↗</a></div>
        <small>A Daly Ventures project · Independent and not affiliated with or endorsed by Mattel</small>
      </footer>
    </main>
  );
}
