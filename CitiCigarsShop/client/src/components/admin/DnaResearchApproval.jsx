import React, { useEffect, useRef, useState } from "react";
import { API_URL } from "@/config";
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Save, Search } from "lucide-react";

const FIELDS = [
  ["brand", "Marque"], ["line", "Ligne / Série"], ["vitole", "Vitole"],
  ["format", "Format"], ["dimensions", "Dimensions"], ["puissance", "Puissance"],
  ["famille1", "Famille 1"], ["famille2", "Famille 2"], ["famille3", "Famille 3"],
  ["intensite", "Intensité"], ["spice", "Spice"], ["sweet", "Sweetness"],
  ["signatures", "Signatures"], ["dureeMin", "Durée min."], ["dureeMax", "Durée max."],
  ["confidence", "Confiance"],
];
const labels = { DRAFT: "À rechercher", RESEARCHED: "Proposé", REVIEW: "À revoir", APPROVED: "Approuvé", REJECTED: "Rejeté" };

function headers(json = false) {
  return { ...(json ? { "Content-Type": "application/json" } : {}),
    "x-cms-token": sessionStorage.getItem("cms_token") || "" };
}
const display = (value) => Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);
const profilePayload = (values) => Object.fromEntries(FIELDS.map(([key]) => [key, values[key] ?? ""]));

export default function DnaResearchApproval() {
  const [query, setQuery] = useState("");
  const [dnaFilter, setDnaFilter] = useState("no");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selectedPoolIds, setSelectedPoolIds] = useState([]);
  const [active, setActive] = useState(null);
  const [finalValues, setFinalValues] = useState({});
  const [memoValidation, setMemoValidation] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  const [manualValues, setManualValues] = useState({ brand: "", line: "", vitole: "", format: "", dimensions: "", note: "" });
  const [batchProgress, setBatchProgress] = useState(null);
  const searchSequence = useRef(0);

  const request = async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, { ...options, headers: headers(Boolean(options.body)) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.detail || body.error || `HTTP ${response.status}`);
    return body;
  };
  const search = async (targetPage = 1) => {
    const sequence = ++searchSequence.current;
    setLoading(true); setMessage("");
    try {
      const params = new URLSearchParams({ q: query.trim(), dna: dnaFilter, page: String(targetPage), limit: "20" });
      const data = await request(`/api/admin/research-pool?${params}`);
      if (sequence === searchSequence.current) {
        setResults(data.rows || []); setPage(data.page); setPages(data.pages || 1);
      }
    } catch (error) { if (sequence === searchSequence.current) setMessage(`Recherche impossible : ${error.message}`); }
    finally { if (sequence === searchSequence.current) setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => search(1), 300);
    return () => window.clearTimeout(timer);
  }, [query, dnaFilter]);

  const openCase = async (id) => {
    setBusy(true); setMessage("");
    try {
      const data = await request(`/api/admin/dna-research-cases/${encodeURIComponent(id)}`);
      setActive(data); setFinalValues(data.finalProfile || data.proposedProfile || data.currentProfile || {});
      setMemoValidation(data.memoValidation || "");
    } catch (error) { setMessage(`Ouverture impossible : ${error.message}`); }
    finally { setBusy(false); }
  };
  const addToQueue = async (poolIds = selectedPoolIds) => {
    const data = await request("/api/admin/dna-research-cases", {
      method: "POST", body: JSON.stringify({ poolIds }),
    });
    setSelectedPoolIds([]);
    if (data.cases?.length) await openCase(data.cases[0].caseId);
    return data.cases || [];
  };
  const batchResearch = async () => {
    if (!selectedPoolIds.length) return;
    setBusy(true); setMessage("");
    try {
      const cases = await addToQueue(selectedPoolIds);
      let done = 0; setBatchProgress({ done, total: cases.length });
      const failed = [];
      for (const item of cases) {
        try { await request(`/api/admin/dna-research-cases/${encodeURIComponent(item.caseId)}/research`, { method: "POST" }); }
        catch (error) { failed.push(`${item.caseId}: ${error.message}`); }
        done += 1; setBatchProgress({ done, total: cases.length });
      }
      if (cases.length) await openCase(cases[0].caseId);
      setMessage(failed.length ? `${done - failed.length}/${done} recherches terminées. ${failed.join("; ")}` : `${done} recherches terminées; validation humaine requise.`);
    } catch (error) { setMessage(`Lot impossible : ${error.message}`); }
    finally { setBusy(false); setBatchProgress(null); }
  };
  const createManual = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const candidate = await request("/api/admin/research-pool", { method: "POST", body: JSON.stringify(manualValues) });
      await addToQueue([candidate.poolId]); setManual(false);
      setMessage("Nouveau candidat créé dans le Pool, sans CIGAR_ID et sans DNA automatique.");
    } catch (error) { setMessage(`Création impossible : ${error.message}`); }
    finally { setBusy(false); }
  };
  const directUpdate = async () => {
    setBusy(true);
    try { await request(`/api/admin/dna-research-cases/${active.caseId}/update-direct`, { method: "POST" }); await openCase(active.caseId); }
    catch (error) { setMessage(`Mise à jour impossible : ${error.message}`); }
    finally { setBusy(false); }
  };
  const research = async () => {
    setBusy(true); setMessage("");
    try { await request(`/api/admin/dna-research-cases/${active.caseId}/research`, { method: "POST" }); await openCase(active.caseId);
      setMessage("Recherche terminée. La proposition agent reste immutable jusqu’à l’approbation humaine."); }
    catch (error) { setMessage(`Recherche impossible : ${error.message}`); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try { await request(`/api/admin/dna-research-cases/${active.caseId}`, { method: "PUT",
      body: JSON.stringify({ finalProfile: profilePayload(finalValues), memoValidation }) });
      await openCase(active.caseId); setMessage("Valeur candidate enregistrée; profil actuel inchangé."); }
    catch (error) { setMessage(`Enregistrement impossible : ${error.message}`); }
    finally { setBusy(false); }
  };
  const approve = async () => {
    setBusy(true);
    try { await request(`/api/admin/dna-research-cases/${active.caseId}/approve`, { method: "POST",
      body: JSON.stringify({ finalProfile: profilePayload(finalValues), memoValidation, approvedBy: "Claudel" }) });
      await openCase(active.caseId); setMessage("Profil DNA approuvé explicitement."); }
    catch (error) { setMessage(`Approbation impossible : ${error.message}`); }
    finally { setBusy(false); }
  };
  const admit = async () => {
    try { await request(`/api/admin/dna-research-cases/${active.caseId}/admit`, { method: "POST" }); }
    catch (error) { setMessage(error.message); }
  };

  if (active) {
    const updateMode = active.caseType === "UPDATE" || Boolean(active.currentProfileSnapshot);
    const left = updateMode ? (active.currentProfile || active.currentProfileSnapshot || {}) : (active.proposedProfile || {});
    return <div className="max-w-7xl mx-auto space-y-5">
      <button onClick={() => { setActive(null); search(page); }} className="inline-flex items-center gap-2 font-semibold"><ChevronLeft size={18}/>Retour au Research Pool</button>
      <section className="bg-white border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between gap-4"><div><div className="text-xs text-muted-foreground">{active.cigarId || "Aucun CIGAR_ID"}</div>
          <h1 className="text-2xl font-serif font-bold">{active.pool.brand} — {active.pool.line}</h1>
          <p>{active.pool.vitole || "—"}{active.pool.dimensions ? ` • ${active.pool.dimensions}` : ""}</p></div>
          <span className="font-semibold">{labels[active.status] || active.status}</span></div>
        {active.hasExistingDna && active.status === "DRAFT" && <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={directUpdate} disabled={busy} className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold">Mettre à jour le profil DNA — édition directe</button>
          <button onClick={research} disabled={busy} className="px-4 py-2 rounded border font-semibold">Mettre à jour le profil DNA — rechercher à nouveau</button>
        </div>}
        {!active.hasExistingDna && !active.proposedProfile && <button onClick={research} disabled={busy} className="mt-5 px-4 py-2 rounded bg-primary text-primary-foreground font-semibold">Lancer la recherche DNA</button>}
      </section>
      {(active.proposedProfile || updateMode) && <section className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <header className="p-5 border-b"><h2 className="text-xl font-bold">Profil DNA — 16 champs</h2>
          <p className="text-sm text-muted-foreground">{updateMode ? "Actuel intact à gauche. Mise à jour candidate à droite." : "Proposition agent immutable à gauche. Valeur finale éditable à droite."}</p></header>
        <div className="divide-y">{FIELDS.map(([key, label]) => <div key={key} className="grid md:grid-cols-[160px_1fr_1fr] gap-3 p-4">
          <strong className="text-sm md:pt-2">{label}</strong><label className="text-xs text-muted-foreground">{updateMode ? "Actuel" : "Proposition"}<input readOnly value={display(left[key])} className="block mt-1 w-full border rounded px-3 py-2 bg-amber-50/40"/></label>
          <label className="text-xs text-muted-foreground">{updateMode ? "Mise à jour" : "Valeur finale"}<input value={display(finalValues[key])} onChange={(event) => setFinalValues((old) => ({ ...old, [key]: event.target.value }))} className="block mt-1 w-full border rounded px-3 py-2 bg-emerald-50/30"/></label>
        </div>)}</div>
      </section>}
      {active.evidence?.length > 0 && <section className="bg-white border rounded-xl p-5"><h2 className="font-bold mb-2">Historique CA / CJ</h2>
        <div className="flex flex-wrap gap-2">{active.evidence.map((item) => <span key={item.id} className="px-3 py-1 bg-muted rounded-full text-sm">{item.rankingSource} {item.rankingYear} — #{item.rankingRank}{item.rankingRating ? ` (${item.rankingRating})` : ""}</span>)}</div></section>}
      {(active.proposedProfile || updateMode) && <section className="grid lg:grid-cols-2 gap-4"><textarea readOnly rows={6} value={active.memoResearch || ""} className="border rounded p-3 bg-muted/20" placeholder="Mémo recherche / sources"/>
        <textarea rows={6} value={memoValidation} onChange={(event) => setMemoValidation(event.target.value)} className="border rounded p-3" placeholder="Mémo validation / arbitrage"/></section>}
      {(active.proposedProfile || updateMode) && <div className="flex flex-wrap gap-3"><button onClick={save} disabled={busy || active.status === "APPROVED"} className="inline-flex gap-2 px-4 py-2 border rounded font-semibold"><Save size={18}/>Enregistrer</button>
        <button onClick={approve} disabled={busy || active.status === "APPROVED"} className="inline-flex gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold"><CheckCircle2 size={18}/>Approuver le DNA</button>
        {active.status === "APPROVED" && !active.cigarId && <button onClick={admit} className="px-4 py-2 border rounded font-semibold">Admettre au catalogue</button>}</div>}
      {message && <p className="bg-muted rounded p-3 text-sm font-medium">{message}</p>}
    </div>;
  }

  return <div className="max-w-7xl mx-auto space-y-5"><div><h1 className="text-3xl font-serif font-bold">DNA Researcher</h1><p className="text-muted-foreground">File de travail alimentée par le Research Pool cigar-only.</p></div>
    <section className="bg-white border rounded-xl p-4 shadow-sm"><div className="flex flex-col md:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-muted-foreground" size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(1)} placeholder="Rechercher marque, ligne, vitole, factory ou fabricant…" className="w-full border rounded pl-10 pr-3 py-2"/></div>
      <label className="flex items-center gap-2 border rounded px-3 py-2 whitespace-nowrap"><span className="text-sm font-semibold">DNA</span><select value={dnaFilter} onChange={(e) => setDnaFilter(e.target.value)} className="bg-transparent font-medium outline-none"><option value="no">Non</option><option value="yes">Oui</option><option value="all">Tous</option></select></label>
      <button onClick={() => search(1)} className="px-4 py-2 bg-primary text-primary-foreground rounded font-semibold">Rechercher</button><button onClick={() => setManual(!manual)} className="inline-flex items-center gap-2 px-4 py-2 border rounded font-semibold"><Plus size={18}/>Ajouter un nouveau candidat</button></div></section>
    {manual && <form onSubmit={createManual} className="bg-white border rounded-xl p-5 grid md:grid-cols-3 gap-3">{["brand","line","vitole","format","dimensions","note"].map((key) => <input key={key} required={["brand","line","vitole"].includes(key)} value={manualValues[key]} onChange={(e) => setManualValues((old) => ({...old,[key]:e.target.value}))} placeholder={{brand:"Marque *",line:"Ligne *",vitole:"Vitole *",format:"Format (optionnel)",dimensions:"Dimensions (optionnel)",note:"Note/source (optionnel)"}[key]} className="border rounded px-3 py-2"/>)}<button disabled={busy} className="px-4 py-2 bg-primary text-primary-foreground rounded font-semibold">Créer sans CIGAR_ID</button></form>}
    {selectedPoolIds.length > 0 && <div className="sticky top-2 z-10 bg-primary text-primary-foreground rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"><strong>{selectedPoolIds.length} cigare(s) sélectionné(s)</strong><div className="flex gap-2"><button onClick={() => addToQueue()} disabled={busy} className="px-3 py-2 bg-white text-primary rounded font-semibold">Ajouter à la recherche DNA</button><button onClick={batchResearch} disabled={busy} className="px-3 py-2 border border-white rounded font-semibold">Lancer le batch research</button></div></div>}
    {batchProgress && <p>Progression : {batchProgress.done}/{batchProgress.total}</p>}
    <section className="space-y-3">{loading ? <p>Chargement…</p> : results.map((row) => <article key={row.poolId} className="bg-white border rounded-xl p-4 flex gap-4 justify-between"><label className="flex gap-4 cursor-pointer"><input type="checkbox" checked={selectedPoolIds.includes(row.poolId)} onChange={() => setSelectedPoolIds((old) => old.includes(row.poolId) ? old.filter((id) => id !== row.poolId) : [...old,row.poolId])}/><span><strong>{row.brand} — {row.line}</strong><span className="block text-sm">{row.vitole || "—"}{row.format ? ` • ${row.format}` : ""}{row.dimensions ? ` • ${row.dimensions}` : ""}</span><span className="block text-xs text-muted-foreground">{row.cigarId || "Aucun CIGAR_ID"} • sourcing {row.sourcingRating || "—"} • DNA {row.hasExistingDna ? "Oui" : "Non"}{row.originCountry ? ` • ${row.originCountry}` : ""}</span></span></label>
        {row.activeCase && <button onClick={() => openCase(row.activeCase.caseId)} className="self-start px-3 py-2 border rounded font-semibold">Ouvrir la file</button>}</article>)}</section>
    <div className="flex justify-center items-center gap-4"><button disabled={page <= 1} onClick={() => search(page - 1)} className="p-2 border rounded disabled:opacity-30"><ChevronLeft/></button><span>Page {page} / {pages}</span><button disabled={page >= pages} onClick={() => search(page + 1)} className="p-2 border rounded disabled:opacity-30"><ChevronRight/></button></div>
    {message && <p className="bg-muted rounded p-3 text-sm font-medium">{message}</p>}
  </div>;
}
