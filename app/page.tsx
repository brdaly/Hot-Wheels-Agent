"use client";

/* eslint-disable @next/next/no-img-element -- remote release references and local object URLs are intentional */
import { DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "@/package.json";
import carSuggestions from "@/data/car-search-index.json";
import hunts from "@/data/hunt-map-2026.json";
import { PUBLIC_DEMO_REVIEWED_ON, PUBLIC_DEMO_RULESET, publicDemoScenarios } from "@/data/public-demo-scenarios";
import retail from "@/data/us-retail-2026-08-27.json";
import { deriveResultPresentation } from "@/lib/result-presentation";

const PRODUCT_NAME = "Hot Wheels Collector Intelligence";
const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type EvidenceSource = {
  id?: string;
  label?: string;
  name?: string;
  publisher?: string | null;
  kind?: string | null;
  authority?: string | null;
  url?: string | null;
  asOf?: string | null;
  capturedAt?: string | null;
  freshness?: string | null;
  freshnessWindowDays?: number;
  note?: string | null;
};

type DecisionGate = {
  code?: string;
  label: string;
  action?: string | null;
  status?: "pass" | "fail" | "unknown" | string;
  severity?: "blocking" | "caution" | "info" | string;
};

type CollectionContext = {
  state?: string | null;
  status?: string | null;
  lookupStatus?: string | null;
  ownedQuantity?: number | null;
  ownedCount?: number | null;
  duplicateIntent?: string | null;
  copyIntent?: string | null;
  isDuplicate?: boolean | null;
  note?: string | null;
};

type SoldComp = {
  sourceUrl: string;
  soldAt: string;
  price: number;
  currency: string;
  matchQuality: "exact" | "near" | "unknown" | string;
  condition?: string | null;
  packaging?: string | null;
  conditionComparable?: boolean | null;
  packagingComparable?: boolean | null;
};

type CarResult = {
  rank: number;
  observationId: string;
  identification: {
    casting: string;
    brand: string;
    releaseYear: number | null;
    line: string;
    chaseStatus: string;
    confidence: string;
    productCode?: string | null;
    colorOrLivery?: string | null;
    chaseMarkersObserved?: string[];
  };
  score: { total: number; tier: string; components: Record<string, number>; componentReasons?: Record<string, string>; modelVersion?: string | null };
  marketEvidenceGrade: string;
  marketEvidenceCount?: number | null;
  marketEvidence?: {
    status?: string;
    grade?: string;
    newestSaleDate?: string | null;
    exactSoldComps?: SoldComp[];
    comparisonCurrency?: string | null;
    notes?: string[];
  } | null;
  condition: { grade: string };
  recommendation: {
    decision: string;
    packaging: string;
    conditionGrade?: string | null;
    conditionGate: { status: string; label: string };
    verifyFirst?: boolean;
    verificationReasons?: string[];
    collectionContext?: CollectionContext | null;
    rationale?: string[];
  };
  priceGate: {
    verdict: string;
    note: string;
    benchmark?: { retailer?: string; sourceUrl?: string; asOf?: string; normalPrice?: number } | null;
    freshness?: { asOf?: string; ageDays?: number; status?: string } | null;
  };
  evidenceObserved?: string[];
  verificationNeeded: string[];
  limitations?: string[];
  sources?: EvidenceSource[];
  evidenceSources?: EvidenceSource[];
  gates?: DecisionGate[];
  decisionState?: string | null;
  collection?: CollectionContext | null;
  collectionContext?: CollectionContext | null;
};

type Result = {
  traceId: string;
  evaluationId: string | null;
  generatedAt?: string | null;
  contractVersion?: string | null;
  persistenceWarning?: string | null;
  cars: CarResult[];
  scene: { caseOrMixInference: string | null; inferenceEvidence: string[] };
  proactiveTargets: Array<{ name: string; reason: string; visualMarkers: string[]; confidence: string }>;
  limitations: string[];
  sources?: EvidenceSource[];
};

type Tab = "showcase" | "hunts" | "market" | "analyze";
type AuthStatus = "checking" | "authenticated" | "required";
type CollectionState = "unknown" | "first_copy" | "duplicate";
type DuplicateIntent = "" | "open_display" | "condition_upgrade" | "trade" | "resale" | "sealed_copy" | "gift";
type CollectionControl = { state: CollectionState; intent: DuplicateIntent };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "showcase", label: "Public Demo" },
  { id: "hunts", label: "Chase Grid" },
  { id: "market", label: "US Retail" },
  { id: "analyze", label: "Owner Workspace" },
];

const photoSlots = [
  { title: "Full card + blister", note: "Show the entire front, product name and package edges." },
  { title: "Wheels + chase detail", note: "Fill the frame with wheels, paint and any chase marker." },
  { title: "Base or product code", note: "Capture small codes sharply; they support rather than prove identity." },
  { title: "Back, side or peg context", note: "Add card-back details, condition evidence or the wider store scene." },
] as const;

const componentLabels: Record<string, string> = {
  releaseSignificance: "Release significance",
  castingDesirability: "Casting desirability",
  lineExecution: "Line execution",
  cultureStory: "Culture and story",
  marketLiquidity: "Estimated liquidity",
  personalFit: "Collection fit",
  riskClarity: "Risk clarity",
};

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.length === 10 ? `${value}T00:00:00Z` : value}`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function freshness(value?: string | null, maxAgeDays = 30) {
  if (!value) return { status: "unknown", label: "Freshness unknown" };
  const date = new Date(`${value.length === 10 ? `${value}T00:00:00Z` : value}`);
  if (Number.isNaN(date.getTime())) return { status: "unknown", label: "Freshness unknown" };
  const ageDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return ageDays <= maxAgeDays
    ? { status: "current", label: `Current · ${ageDays === 0 ? "today" : `${ageDays}d old`}` }
    : { status: "stale", label: `Recheck · ${ageDays}d old` };
}

function upstreamCollectionState(car: CarResult): CollectionControl {
  const context = car.collectionContext ?? car.collection ?? car.recommendation.collectionContext;
  const state = `${context?.state ?? context?.status ?? ""}`.toLowerCase();
  const quantity = context?.ownedQuantity ?? context?.ownedCount;
  if (state.includes("duplicate") || context?.isDuplicate || (quantity != null && quantity > 0)) {
    const intent = context?.duplicateIntent ?? context?.copyIntent;
    const normalizedIntent: DuplicateIntent = intent === "open_display" || intent === "condition_upgrade" || intent === "trade" || intent === "resale" || intent === "sealed_copy" || intent === "gift" ? intent : intent === "opener_copy" ? "open_display" : "";
    return { state: "duplicate", intent: normalizedIntent };
  }
  if (state.includes("first") || context?.copyIntent === "first_copy" || (context?.lookupStatus === "complete" && quantity === 0)) return { state: "first_copy", intent: "" };
  return { state: "unknown", intent: "" };
}

function sourceDate(source: EvidenceSource) {
  return source.asOf ?? source.capturedAt ?? null;
}

function SourceList({ sources, emptyMessage }: { sources: EvidenceSource[]; emptyMessage: string }) {
  if (!sources.length) return <p className="empty-evidence">{emptyMessage}</p>;
  return (
    <ul className="source-list">
      {sources.map((source, index) => {
        const date = sourceDate(source);
        const age = freshness(date, source.freshnessWindowDays ?? 30);
        const href = safeExternalUrl(source.url);
        const label = source.label ?? source.name ?? source.publisher ?? `Evidence source ${index + 1}`;
        const sourceFreshness = source.freshness ? pretty(source.freshness) : age.label;
        return (
          <li key={source.id ?? `${label}-${index}`}>
            <div>
              <b>{href ? <a href={href} target="_blank" rel="noreferrer">{label} ↗</a> : label}</b>
              <span>{pretty(source.kind ?? source.authority ?? "Supporting source")}</span>
              {source.note && <p>{source.note}</p>}
            </div>
            <div className="source-freshness">
              <span className={`freshness-chip ${source.freshness?.toLowerCase() ?? age.status}`}>{sourceFreshness}</span>
              {date && <time dateTime={date}>{formatDate(date)}</time>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ResultCard({ car, collection, onCollectionChange }: { car: CarResult; collection: CollectionControl; onCollectionChange: (value: CollectionControl) => void }) {
  const externalGates = (car.gates ?? []).filter((gate) => gate.severity === "blocking" && gate.status !== "pass").map((gate) => gate.action ?? gate.label);
  const chaseNeedsMarker = ["regular_th", "super_th", "premium_chase", "error"].includes(car.identification.chaseStatus) && !(car.identification.chaseMarkersObserved?.length);
  const soldComps = car.marketEvidence?.exactSoldComps ?? [];
  const initialPresentation = deriveResultPresentation({
    recommendation: car.recommendation,
    upstreamVerify: false,
    otherVerificationCount: 0,
    marketEvidenceCount: car.marketEvidenceCount,
    marketEvidenceGrade: car.marketEvidenceGrade,
  });
  const soldCompCount = initialPresentation.marketEvidenceCount;
  const collectionChecks = collection.state === "unknown"
    ? ["Confirm whether this exact release is already in the collection."]
    : collection.state === "duplicate" && !collection.intent
      ? ["Choose the purpose for another copy before making a duplicate purchase."]
      : collection.state === "duplicate" && collection.intent === "resale" && !soldCompCount
        ? ["Add recent exact sold transactions before treating a duplicate as a resale opportunity."]
        : [];
  const otherVerificationChecks = unique([
    ...(car.verificationNeeded ?? []),
    ...(car.recommendation.verificationReasons ?? []),
    ...externalGates,
    ...(car.identification.confidence === "high" ? [] : ["Confirm the exact release, colorway and packaging details."]),
    ...(chaseNeedsMarker ? ["Confirm the required chase marker from the card or vehicle."] : []),
    ...collectionChecks,
  ]);
  const upstreamVerify = car.recommendation.verifyFirst || `${car.decisionState ?? ""}`.toLowerCase().includes("verify");
  const presentation = deriveResultPresentation({
    recommendation: car.recommendation,
    upstreamVerify: Boolean(upstreamVerify),
    otherVerificationCount: otherVerificationChecks.length,
    marketEvidenceCount: car.marketEvidenceCount,
    marketEvidenceGrade: car.marketEvidenceGrade,
  });
  const verificationChecks = unique([
    ...otherVerificationChecks,
    ...(presentation.conditionNeedsVerification ? [presentation.conditionAction] : []),
  ]);
  const { conditionAction, conditionGrade, conditionStatus, presentationState, verifyFirst } = presentation;
  const marketGrade = presentation.marketEvidenceGrade;
  const identityEvidence = `${pretty(car.identification.confidence)} · ${car.evidenceObserved?.length ?? 0} observation${car.evidenceObserved?.length === 1 ? "" : "s"}`;
  const sources = [...(car.sources ?? car.evidenceSources ?? [])];
  if (car.priceGate.benchmark?.sourceUrl) {
    sources.push({ id: `retail-${car.observationId}`, label: car.priceGate.benchmark.retailer ?? "US retail benchmark", kind: "Retail reference", url: car.priceGate.benchmark.sourceUrl, asOf: car.priceGate.freshness?.asOf ?? car.priceGate.benchmark.asOf ?? retail.asOf, freshnessWindowDays: 45, note: "Retail reference only; not a secondary-market valuation." });
  }
  soldComps.forEach((comp, index) => sources.push({ id: `sold-${car.observationId}-${index}`, label: `Completed sale · ${formatMoney(comp.price, comp.currency)}`, kind: "Exact-release sold transaction", url: comp.sourceUrl, asOf: comp.soldAt, freshnessWindowDays: 180, note: `${pretty(comp.matchQuality)} match${comp.condition ? ` · ${comp.condition}` : ""}${comp.packaging ? ` · ${comp.packaging}` : ""}.` }));
  const cardId = car.observationId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const collectionLabel = collection.state === "first_copy" ? "First recorded copy" : collection.state === "duplicate" ? collection.intent ? `Duplicate · ${pretty(collection.intent)}` : "Duplicate · purpose unresolved" : "Collection not checked";
  const displayDecision = verifyFirst
    ? "Verify first"
    : presentationState === "fail"
      ? conditionAction
      : presentationState === "caution"
        ? "Condition caution"
        : collection.state === "duplicate" ? car.score.total >= 75 ? "Purposeful duplicate" : "Skip duplicate" : car.recommendation.decision;
  const decisionCopy = verifyFirst
    ? `No buy call yet. Complete the blocking checks before acting on the score or price signal. Condition gate: ${conditionAction}.`
    : presentationState === "fail"
      ? `${conditionAction}. The condition gate does not support a clean carded hold.`
      : presentationState === "caution"
        ? `${conditionAction}. Treat condition as a negative constraint before buying.`
        : collection.state === "duplicate"
      ? `Duplicate purpose confirmed: ${pretty(collection.intent)}. Apply the price and condition gates before adding another copy.`
      : "Identity and collection context are clear enough to apply the collection, condition and price signals independently.";

  const bannerLabel = verifyFirst ? "VERIFY FIRST" : presentationState === "fail" ? "CONDITION FAIL" : presentationState === "caution" ? "CONDITION CAUTION" : "DECISION READY";

  return (
    <article className={`car ${presentationState === "verify" ? "verify-first" : presentationState === "ready" ? "decision-ready" : `condition-${presentationState}`}`} aria-labelledby={`car-title-${cardId}`}>
      <div className="rank" aria-label={`Result rank ${car.rank}`}>#{car.rank}</div>
      <div className="score" aria-label={`Model-assisted collection fit score ${car.score.total} out of 100, tier ${car.score.tier}`}><strong>{car.score.total}</strong><span>{car.score.tier}</span><small>fit</small></div>
      <div className="car-main">
        <div className={`decision-banner ${presentationState}`}>
          <div><span>{bannerLabel}</span><b>{collectionLabel}</b></div>
          <p>{decisionCopy}</p>
        </div>

        <p className="eyebrow">{car.identification.confidence} identity confidence · {pretty(car.identification.chaseStatus)}</p>
        <h3 id={`car-title-${cardId}`}>{car.identification.casting}</h3>
        <p>{car.identification.releaseYear ?? "Year unresolved"} · {car.identification.line}{car.identification.productCode ? ` · ${car.identification.productCode}` : ""}</p>

        <div className="signal-grid" aria-label="Independent decision signals">
          <div><span>Collection fit</span><b>{car.score.total}/100 · {car.score.tier}</b><small>Model-assisted inputs</small></div>
          <div><span>Identity evidence</span><b>{identityEvidence}</b><small>Review observations below</small></div>
          <div><span>Price gate</span><b>{pretty(car.priceGate.verdict)}</b><small>{car.priceGate.note}</small></div>
          <div><span>Market evidence</span><b>{soldCompCount ? `Grade ${marketGrade} · ${soldCompCount} recent exact` : "Grade U · none supplied"}</b><small>{soldCompCount ? "180-day exact-match window" : "No financial-upside claim"}</small></div>
        </div>

        <div className="collection-context">
          <div>
            <label htmlFor={`collection-${cardId}`}>Copy context</label>
            <select id={`collection-${cardId}`} value={collection.state} onChange={(event) => onCollectionChange({ state: event.target.value as CollectionState, intent: "" })}>
              <option value="unknown">Not checked</option><option value="first_copy">First copy</option><option value="duplicate">Already own exact release</option>
            </select>
          </div>
          {collection.state === "duplicate" && <div><label htmlFor={`intent-${cardId}`}>Purpose for another copy</label><select id={`intent-${cardId}`} value={collection.intent} onChange={(event) => onCollectionChange({ state: "duplicate", intent: event.target.value as DuplicateIntent })}><option value="">Choose purpose</option><option value="open_display">Open/display pair</option><option value="sealed_copy">Second sealed copy</option><option value="condition_upgrade">Condition upgrade</option><option value="gift">Gift</option><option value="trade">Trade inventory</option><option value="resale">Resale/speculative</option></select></div>}
          <p>Decision context is local to this result and is not saved automatically.</p>
        </div>

        <div className="badges"><span className={presentationState === "ready" ? "pass" : presentationState}>{displayDecision}</span><span>Market evidence {marketGrade}</span><span className={conditionStatus}>{pretty(conditionGrade)} · {conditionAction}</span><span className={car.priceGate.verdict}>{pretty(car.priceGate.verdict)}</span></div>
        <p className="verdict"><b>{verifyFirst ? "No buy call yet." : presentationState === "fail" ? `${conditionAction}.` : presentationState === "caution" ? "Condition caution." : `${displayDecision}.`}</b> {verifyFirst ? "The collection-fit score remains visible for comparison, but it cannot override a blocking verification gate." : presentationState === "fail" ? "The deterministic condition gate overrides a positive collection-fit score for a clean carded hold." : presentationState === "caution" ? `${conditionAction}. Apply the condition constraint before the price signal.` : `${car.recommendation.packaging}. ${car.priceGate.note}`}</p>

        {verificationChecks.length > 0 && <section className="verification-panel" aria-labelledby={`verify-${cardId}`}><div><span>BLOCKING CHECKS</span><h4 id={`verify-${cardId}`}>Complete before deciding</h4></div><ul>{verificationChecks.map((item) => <li key={item}>{item}</li>)}</ul></section>}

        <div className="evidence-columns">
          <section aria-labelledby={`observed-${cardId}`}><h4 id={`observed-${cardId}`}>Evidence observed</h4>{car.evidenceObserved?.length ? <ul>{car.evidenceObserved.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="empty-evidence">No itemized observations were returned. Treat the identity as model-assisted.</p>}</section>
          <section aria-labelledby={`sources-${cardId}`}><h4 id={`sources-${cardId}`}>Sources and freshness</h4><SourceList sources={sources} emptyMessage="No external exact-release source is attached. Verify against an official or trusted collector reference." />{car.marketEvidence?.notes?.length ? <ul className="market-notes">{car.marketEvidence.notes.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>
        </div>

        {car.limitations?.length ? <div className="card-limitations"><b>Result limitations</b><ul>{car.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
        <details className="score-details"><summary>How the collection-fit score was built</summary><p>Arithmetic is deterministic; the component inputs are model-assisted estimates and are not resale forecasts.</p><dl>{Object.entries(car.score.components).map(([key, value]) => <div key={key}><dt>{componentLabels[key] ?? pretty(key)}{car.score.componentReasons?.[key] && <small>{car.score.componentReasons[key]}</small>}</dt><dd>{value}</dd></div>)}</dl></details>
      </div>
    </article>
  );
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("showcase");
  const [demoId, setDemoId] = useState(publicDemoScenarios[0].id);
  const [collectionOverrides, setCollectionOverrides] = useState<Record<string, CollectionControl>>({});
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const activeDemo = publicDemoScenarios.find((scenario) => scenario.id === demoId) ?? publicDemoScenarios[0];
  const ready = files.length > 0 || query.trim().length >= 2;
  const statusMessage = busy ? "Collector analysis is running. This can take up to 90 seconds." : result ? `Analysis complete. ${result.cars.length} ${result.cars.length === 1 ? "release" : "releases"} returned.` : "Ready for collector evidence.";

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => { if (result) resultsRef.current?.focus(); }, [result]);
  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => { if (active) setAuthStatus(body.authenticated ? "authenticated" : "required"); })
      .catch(() => { if (active) setAuthStatus("required"); });
    return () => { active = false; };
  }, []);

  function addFiles(next: File[]) {
    const rejected: string[] = [];
    const accepted = [...files];
    for (const file of next) {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) { rejected.push(`${file.name}: use JPEG, PNG or WebP.`); continue; }
      if (file.size > MAX_FILE_BYTES) { rejected.push(`${file.name}: maximum size is 8 MB.`); continue; }
      if (accepted.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue;
      if (accepted.length >= MAX_FILES) { rejected.push(`Upload no more than ${MAX_FILES} images.`); break; }
      accepted.push(file);
    }
    setFiles(accepted);
    setError(unique(rejected).join(" "));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }
  function removeFile(index: number) { setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); setError(""); }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: Tab) {
    const currentIndex = tabs.findIndex((item) => item.id === current);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    const next = tabs[nextIndex].id;
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  }

  function openTab(next: Tab, scrollToPanel = false) {
    setTab(next);
    if (scrollToPanel) requestAnimationFrame(() => document.getElementById(`panel-${next}`)?.scrollIntoView({ block: "start" }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || authStatus !== "authenticated") return;
    setBusy(true); setError(""); setResult(null); setCollectionOverrides({});
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    form.set("query", query.trim()); form.set("market", "US"); form.set("currency", "USD");
    if (price) form.set("observedPrice", price);
    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const text = await response.text();
      let body: Partial<Result> & { error?: string } = {};
      try { body = text ? JSON.parse(text) as Partial<Result> & { error?: string } : {}; }
      catch { body = { error: response.ok ? "Analysis returned an unreadable response" : "Analysis service is temporarily unavailable" }; }
      if (response.status === 401) setAuthStatus("required");
      if (!response.ok) throw new Error(`${body.error ?? "Analysis failed"}${body.traceId ? ` Trace: ${body.traceId}` : ""}`);
      if (!Array.isArray(body.cars)) throw new Error("Analysis completed without a usable result. Please retry.");
      setResult(body as Result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analysis failed"); }
    finally { setBusy(false); }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setSigningIn(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Sign-in failed");
      setPassword("");
      setAuthStatus("authenticated");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    setResult(null);
    setAuthStatus("required");
  }

  const globalLimitations = result ? unique([...(result.limitations ?? []), "Collection-fit scores use model-assisted component estimates; they are decision aids, not return forecasts.", "No resale or financial-upside claim is supported unless recent exact sold transactions are explicitly listed."]) : [];
  const scoreVersions = result ? unique(result.cars.map((car) => car.score.modelVersion)) : [];
  const retailFreshness = freshness(retail.asOf);
  const huntFreshness = freshness(hunts.asOf, 60);

  return (
    <main>
      <a className="skip-link" href="#primary-content">Skip to main content</a>
      <nav aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label={`${PRODUCT_NAME} home`}><img src="/daly-ventures-logo-official.png" alt="Daly Ventures"/><b>{PRODUCT_NAME}</b></a>
        <div className="navlinks" role="tablist" aria-label="Product sections">
          {tabs.map((item) => <button id={`tab-${item.id}`} key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => openTab(item.id)} onKeyDown={(event) => handleTabKeyDown(event, item.id)} className={tab === item.id ? "active" : ""}>{item.label}</button>)}
        </div>
        <a className="site-link" href="https://dalyventures.com/" target="_blank" rel="noreferrer">DalyVentures.com ↗</a>
      </nav>

      <header id="primary-content" tabIndex={-1}>
        <div id="top">
          <div className="beta-line"><span>BETA · v{packageMetadata.version}</span><small>Public rules demo · private live analysis</small></div>
          <p className="eyebrow">DALY VENTURES · {PRODUCT_NAME}</p>
          <h1>Built for<br/>the hunt.<br/><em>Ready to verify.</em></h1>
          <p className="lede">Turn collector evidence into an exact-release candidate, independent decision signals and a clear verification queue before any buy call.</p>
          <div className="hero-actions">
            <button type="button" onClick={() => openTab("showcase", true)}>Explore the public demo</button>
            <button type="button" className="secondary" onClick={() => openTab("analyze", true)}>Owner workspace</button>
          </div>
        </div>
        <div className="signal"><span>CHASE MODE · 2026</span><strong>{hunts.cases.length * 2}</strong><p>TH + STH targets indexed</p><small>Every case · visual field guide</small></div>
      </header>

      <section id="panel-showcase" role="tabpanel" aria-labelledby="tab-showcase" className="data-section public-showcase tab-panel" hidden={tab !== "showcase"}>
        <div className="section-head">
          <div><p className="eyebrow">PUBLIC PRODUCT WALKTHROUGH</p><h2>See how the analyst reaches a decision.</h2></div>
          <p>Explore three reviewed, fictional rules scenarios. No account, upload, live model call or item-specific claim is involved.</p>
        </div>

        <div className="demo-disclosure" role="note">
          <b>PRECOMPUTED RULES DEMO</b>
          <span>Illustrative scenarios · reviewed {formatDate(PUBLIC_DEMO_REVIEWED_ON)} · ruleset {PUBLIC_DEMO_RULESET}</span>
        </div>

        <div className="demo-picker" aria-label="Choose a product walkthrough scenario">
          {publicDemoScenarios.map((scenario, index) => (
            <button key={scenario.id} type="button" aria-pressed={activeDemo.id === scenario.id} onClick={() => setDemoId(scenario.id)}>
              <span>0{index + 1}</span><b>{scenario.pickerLabel}</b><small>{scenario.outcome}</small>
            </button>
          ))}
        </div>

        <article className={`demo-result ${activeDemo.tone}`} aria-labelledby="demo-result-title">
          <div className="demo-visual">
            <img src="/hunt-placeholder.svg" alt="Generic car silhouette used for an illustrative rules demo"/>
            <span>GENERIC ILLUSTRATION · NOT AN EXACT RELEASE</span>
          </div>
          <div className="demo-result-body">
            <p className="eyebrow">{activeDemo.title}</p>
            <h3 id="demo-result-title">{activeDemo.outcome}</h3>
            <p className="demo-premise">{activeDemo.premise}</p>
            <div className={`demo-outcome ${activeDemo.tone}`}><b>{activeDemo.outcome}</b><span>{activeDemo.outcomeSummary}</span></div>
            <div className="signal-grid demo-signal-grid" aria-label="Illustrative independent decision signals">
              {activeDemo.signals.map((signal) => <div key={signal.label}><span>{signal.label}</span><b>{signal.value}</b><small>{signal.note}</small></div>)}
            </div>
            <div className="demo-evidence">
              <section><h4>Scenario evidence</h4><ul>{activeDemo.observed.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h4>{activeDemo.tone === "verify" ? "Blocking checks" : "Next check"}</h4><ul>{activeDemo.nextChecks.map((item) => <li key={item}>{item}</li>)}</ul></section>
            </div>
            <p className="demo-lesson"><b>What this demonstrates:</b> {activeDemo.lesson}</p>
          </div>
        </article>

        <div className="demo-boundary">
          <div><b>Honest by design</b><p>These fictional examples illustrate the published decision policy; they are not calculated or saved production outputs, or disguised live analyses.</p></div>
          <div><b>Private live workspace</b><p>Owner photo uploads, live model analysis and collection records stay behind authentication.</p></div>
          <button type="button" onClick={() => openTab("analyze", true)}>Open owner sign-in</button>
        </div>
      </section>

      <div id="panel-analyze" role="tabpanel" aria-labelledby="tab-analyze" className="tab-panel" hidden={tab !== "analyze"}>
          <section className={`owner-access ${authStatus}`} aria-labelledby="owner-access-title">
            <div>
              <p className="eyebrow">PRIVATE ANALYST WORKSPACE</p>
              <h2 id="owner-access-title">{authStatus === "authenticated" ? "Owner session active" : authStatus === "checking" ? "Checking owner session…" : "Full analysis is in private beta"}</h2>
              <p>{authStatus === "authenticated" ? "Live photo analysis and collection tools are available for this authenticated owner session." : "Photo uploads, live analysis and saved collection records are currently limited to the owner account. The public demo remains available without signing in."}</p>
            </div>
            {authStatus === "required" ? (
              <form onSubmit={signIn}>
                <label>Email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)}/></label>
                <label>Password<input type="password" autoComplete="current-password" required minLength={8} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)}/></label>
                <button type="submit" disabled={signingIn}>{signingIn ? "Signing in…" : "Sign in"}</button>
              </form>
            ) : authStatus === "authenticated" ? <button type="button" className="secondary" onClick={signOut}>Sign out</button> : null}
          </section>
          {authStatus !== "authenticated" && error && <p className="error" role="alert">{error}</p>}
          {authStatus !== "authenticated" && <section className="owner-preview" aria-label="Private workspace capabilities"><article><span>01</span><b>Live evidence analysis</b><p>Analyze owner-provided photos or a named candidate using the guarded pipeline.</p></article><article><span>02</span><b>Exact-release verification</b><p>Keep uncertainty, source freshness and blocking checks visible.</p></article><article><span>03</span><b>Collection context</b><p>Apply first-copy and purposeful-duplicate rules without exposing private records.</p></article></section>}
          {authStatus === "authenticated" && <section className="workbench">
            <div className="section-head"><div><p className="eyebrow">01 · START YOUR SCAN</p><h2>Shoot it. Search it. Verify it.</h2></div><p>Use the full card when possible. Add the back, chase marker or peg wall for sharper exact-release confidence.</p></div>
            <form onSubmit={submit}>
              <ol className="photo-slot-guide" aria-label="Recommended evidence views">
                {photoSlots.map((slot, index) => <li key={slot.title}><span>VIEW {index + 1}</span><b>{slot.title}</b><small>{slot.note}</small></li>)}
              </ol>
              <div className="entry-grid">
                <label className="entry-option camera"><span className="entry-icon">◎</span><b>Take a photo</b><small>JPEG, PNG or WebP · up to 8 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby="upload-guidance" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }}/></label>
                <label className="entry-option gallery"><span className="entry-icon">▧</span><b>Choose photos</b><small>Up to four fronts, backs or peg views</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-describedby="upload-guidance" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }}/></label>
                <label className="entry-option search"><span className="entry-icon">⌕</span><b>Type the car name</b><small>Autocomplete includes current targets</small><input list="car-suggestions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Ferrari F40 Competizione" autoComplete="off"/></label>
                <datalist id="car-suggestions">{carSuggestions.map((car) => <option value={car} key={car}/>)}</datalist>
              </div>

              <div className={`evidence-stage ${previews.length ? "has-files" : ""}`} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
                {previews.length ? <div className="previews">{previews.map(({ file, url }, index) => <figure key={`${file.name}-${file.lastModified}-${index}`}><img src={url} alt={`${photoSlots[index].title}: ${file.name}`}/><figcaption><span>View {index + 1}</span>{photoSlots[index].title}</figcaption><button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>×</button></figure>)}</div> : <><b>Drop collector evidence here</b><span>Or use camera, gallery or car-name search above</span></>}
              </div>

              <div className="controls"><div className="market-lock"><span>Buyer market</span><b>United States · USD</b></div><label>Shelf price (USD)<input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Optional" value={price} onChange={(event) => setPrice(event.target.value)}/></label><button className="primary" disabled={busy || !ready || authStatus !== "authenticated"}>{busy ? "Running collector analysis…" : authStatus !== "authenticated" ? "Sign in to analyze" : "Run collector analysis"}</button></div>
              <p id="upload-guidance" className="entry-note">Photos are normalized to remove metadata and sent with provider storage disabled. Original uploads are not retained locally by default. Structured results are saved only when persistence is explicitly enabled. Name-only searches keep colorway, chase status and package condition as verification gates.</p>
              <p className={`analysis-status ${busy ? "visible" : "sr-only"}`} role="status" aria-live="polite" aria-atomic="true">{statusMessage}</p>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
          </section>}

          {authStatus === "authenticated" && !result && <section className="method-grid" aria-label="Analysis method"><article><span>01</span><h3>Spot</h3><p>Read the casting, card, wheels, livery and visible chase marks.</p></article><article><span>02</span><h3>Verify</h3><p>Separate exact evidence from look-alikes, hype and incomplete IDs.</p></article><article><span>03</span><h3>Score</h3><p>Rank collection fit while keeping price and condition independent.</p></article><article><span>04</span><h3>Decide</h3><p>Check first-copy or duplicate purpose before acting on a recommendation.</p></article></section>}

          {authStatus === "authenticated" && result && (
            <section className="results" ref={resultsRef} tabIndex={-1} aria-labelledby="results-title">
              <div className="section-head"><div><p className="eyebrow">02 · COLLECTOR DECISION</p><h2 id="results-title">{result.cars.length} {result.cars.length === 1 ? "release" : "releases"} assessed</h2></div>{result.scene?.caseOrMixInference && <div className="case-call"><span>CASE SIGNAL · INFERENCE</span><b>{result.scene.caseOrMixInference}</b></div>}</div>

              <div className="analysis-provenance"><div><span>Input basis</span><b>{files.length ? `${files.length} collector photo${files.length === 1 ? "" : "s"}` : `Typed search · ${query}`}</b><small>{result.generatedAt ? `Generated ${formatDate(result.generatedAt)}` : "Response timestamp not returned"}</small></div><div><span>US retail snapshot</span><b>{retailFreshness.label}</b><time dateTime={retail.asOf}>{formatDate(retail.asOf)}</time></div><div><span>Chase reference snapshot</span><b>{huntFreshness.label}</b><time dateTime={hunts.asOf}>{formatDate(hunts.asOf)}</time></div><div><span>Versions</span><b>App v{packageMetadata.version}</b><small>{scoreVersions.length ? scoreVersions.join(" · ") : "Score version not returned"} · {result.contractVersion ? `contract ${result.contractVersion}` : "contract version not returned"}</small></div></div>

              {result.scene?.inferenceEvidence?.length ? <div className="inference-evidence"><b>Why the case signal appeared</b><ul>{result.scene.inferenceEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
              {result.persistenceWarning && <p className="warning" role="status">{result.persistenceWarning}</p>}
              <section className="limitations-panel" aria-labelledby="limitations-title"><div><span>READ BEFORE ACTING</span><h3 id="limitations-title">Limitations and boundaries</h3></div><ul>{globalLimitations.map((item) => <li key={item}>{item}</li>)}</ul></section>
              {result.sources?.length ? <section className="global-sources" aria-labelledby="global-sources-title"><h3 id="global-sources-title">Analysis sources</h3><SourceList sources={result.sources} emptyMessage="No analysis sources returned." /></section> : null}

              {result.cars.map((car) => { const collection = collectionOverrides[car.observationId] ?? upstreamCollectionState(car); return <ResultCard key={car.observationId} car={car} collection={collection} onCollectionChange={(value) => setCollectionOverrides((current) => ({ ...current, [car.observationId]: value }))}/>; })}
              {result.proactiveTargets?.length > 0 && <div className="hunt-box"><p className="eyebrow">YOUR NEXT PEG TARGETS</p><h2>Keep hunting for</h2><div className="target-grid">{result.proactiveTargets.map((target) => <article key={target.name}><b>{target.name}</b><p>{target.reason}</p><small>{target.visualMarkers.join(" · ")}</small></article>)}</div></div>}
              <p className="trace">Trace {result.traceId}{result.evaluationId ? ` · Saved ${result.evaluationId}` : ""} · {PRODUCT_NAME} v{packageMetadata.version}</p>
            </section>
          )}
      </div>

      <section id="panel-hunts" role="tabpanel" aria-labelledby="tab-hunts" className="data-section chase-section tab-panel" hidden={tab !== "hunts"}>
        <div className="section-head"><div><p className="eyebrow">2026 · ATTRIBUTED REFERENCE INDEX</p><h2>The Chase Grid</h2></div><p>Thirty Super Treasure Hunt and regular Treasure Hunt leads, organized by mainline case. Open the attributed source page before calling a chase.</p></div>
        <div className="chase-methodology" aria-labelledby="chase-method-title">
          <div><p className="eyebrow">HOW TO USE THIS GRID</p><h3 id="chase-method-title">A lead index—not an authentication result.</h3></div>
          <ol><li><b>Locate</b><span>Use case placement and product code as starting clues.</span></li><li><b>Open</b><span>Review the attributed release page for exact photography.</span></li><li><b>Cross-check</b><span>Confirm wheels, finish, markings and packaging against a second source.</span></li><li><b>Reverify</b><span>Entries can change; use the update date and report corrections.</span></li></ol>
        </div>
        <div className="hunt-legend"><span><i className="super-dot"/>Super Treasure Hunt</span><span><i className="regular-dot"/>Treasure Hunt</span><small>{hunts.cases.length * 2} targets · updated {hunts.asOf}</small></div>
        <div className="hunt-grid">{hunts.cases.map((item) => <article className="hunt-case" key={item.case}><div className="case-label"><span>MAINLINE</span><strong>CASE {item.case}</strong></div>{([ ["super", item.super], ["regular", item.treasure] ] as const).map(([kind, car]) => <a className={`hunt-car ${kind}`} href={car.sourceUrl} target="_blank" rel="noreferrer" key={car.part}><div className="hunt-image reference-only"><img src="/hunt-placeholder.svg" alt="" aria-hidden="true"/><span>{kind === "super" ? "SUPER TREASURE HUNT" : "TREASURE HUNT"}</span></div><div className="hunt-copy"><small>{car.part}</small><h3>{car.name}</h3><p>Open attributed image and release reference ↗</p></div></a>)}</article>)}</div>
        <p className="source-note">External photographs are not copied or rehosted. Open each attributed release page, then cross-check status and placement with the <a href="https://www.hwtreasure.com/treasure-hunt-checklist/" target="_blank" rel="noreferrer">HWtreasure checklist</a> and <a href="https://orangetrackdiecast.com/2026-hot-wheels-master-list-of-all-lines/" target="_blank" rel="noreferrer">Orange Track 2026 master list</a>.</p>
      </section>

      <section id="panel-market" role="tabpanel" aria-labelledby="tab-market" className="data-section tab-panel" hidden={tab !== "market"}><div className="section-head"><div><p className="eyebrow">UNITED STATES · {retail.asOf}</p><h2>US retail gates</h2></div><p>First-party shelf benchmarks for disciplined buying. These are retail reference points—not secondary-market valuations.</p></div><div className="snapshot-status"><span className={`freshness-chip ${retailFreshness.status}`}>{retailFreshness.label}</span><p>Recheck exact SKU, store and availability before purchase.</p></div><div className="price-grid">{retail.benchmarks.map((row) => <article key={row.category}><small>{pretty(row.category)}</small><strong>${row.normalPrice.toFixed(2)}</strong><p>{row.retailer}</p><span>Lower-price checkpoint ≤ ${row.strongBuyAtOrBelow.toFixed(2)}</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">Retail source ↗</a></article>)}</div><div className="notes">{retail.notes.map((note) => <p key={note}>↳ {note}</p>)}</div></section>

      <section className="footer-disclosures" aria-label="Disclosures and privacy">
        <article id="disclaimer"><p className="eyebrow">DISCLOSURE</p><h3>Informational estimates only.</h3><p>Automated and illustrative outputs are not professional appraisals, return forecasts or a substitute for inspecting the exact item. Verify high-value claims before buying or selling.</p><a href="/disclaimer">Read the full disclaimer →</a></article>
        <article id="privacy"><p className="eyebrow">PHOTO PRIVACY</p><h3>Owner uploads are handled narrowly.</h3><p>Images are normalized to remove metadata and sent with provider storage disabled. Original uploads are not retained locally by default.</p><a href="/privacy">Read the privacy notice →</a></article>
      </section>

      <footer>
        <div><b>{PRODUCT_NAME}</b><p>Collector intelligence, not a return forecast. Exact releases and high-value claims require verification.</p><div className="footer-nav"><a href="/disclaimer">Disclaimer</a><a href="/privacy">Privacy</a><button type="button" onClick={() => openTab("analyze", true)}>Owner sign in</button></div></div>
        <div className="reference-sources"><b>Reference sources</b><a href="https://orangetrackdiecast.com/hot-wheels-casting-database/" target="_blank" rel="noreferrer">Orange Track Database ↗</a><a href="https://www.hwtreasure.com/" target="_blank" rel="noreferrer">HWtreasure ↗</a></div>
        <small>A Daly Ventures project · Independent and not affiliated with or endorsed by Mattel · Beta v{packageMetadata.version}</small>
      </footer>
    </main>
  );
}
