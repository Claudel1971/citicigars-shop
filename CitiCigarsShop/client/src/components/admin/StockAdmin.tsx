import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, History, MapPin, PackageSearch, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { API_URL } from "@/config";
import {
  STOCK_ADMIN_OPERATIONS,
  locationLabel,
  operationDefinition,
  operationalErrorMessage,
  operationQuantity,
  stockIdentityLabel,
  submitMovementAndRefresh,
  validateMovementDraft,
  type StockAdminMovementType,
} from "./stock-admin-model";

const BUCKETS = [
  ["onHand", "En main"], ["reservedClient", "Réservé client"], ["reservedEvent", "Réservé événement"],
  ["atEvent", "À l’événement"], ["deposit", "En dépôt"], ["transit", "En transit"],
] as const;

class StockApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: unknown) {
    super(message || code);
  }
}

async function stockRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      "x-cms-token": sessionStorage.getItem("cms_token") || "",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new StockApiError(response.status, body.error, body.message, body.details);
  return body;
}

function BucketGrid({ balance }: { balance: any }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
    {BUCKETS.map(([key, label]) => <div key={key} className="rounded-lg border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold tabular-nums">{balance?.buckets?.[key] ?? 0}</div>
    </div>)}
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
      <div className="text-xs text-emerald-800">Disponible maintenant</div><div className="text-2xl font-bold text-emerald-900 tabular-nums">{balance?.availableNow ?? 0}</div>
    </div>
  </div>;
}

export function StockPositionsTable({ positions, onOpen }: { positions: any[]; onOpen: (identity: any) => void }) {
  if (!positions.length) return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Aucun SKU ne correspond à la recherche.</div>;
  return <div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full min-w-[1050px] text-sm">
    <thead className="bg-muted/60 text-left"><tr>{["SKU / produit", "Identité", "En main", "Rés. client", "Rés. événement", "Événement", "Dépôt", "Transit", "Disponible", "État"].map((title) => <th key={title} className="px-3 py-3 font-semibold">{title}</th>)}</tr></thead>
    <tbody className="divide-y">{positions.map((row, index) => <tr key={`${row.sku.sku}-${row.identity?.type || "NONE"}-${row.identity?.packSize || index}`} className={row.hasPosition ? "hover:bg-muted/30" : "bg-slate-50 text-muted-foreground"}>
      <td className="px-3 py-3"><div className="font-semibold text-foreground">{row.sku.sku}</div><div className="text-xs">{[row.sku.marque, row.sku.ligne, row.sku.vitole].filter(Boolean).join(" · ") || row.sku.kind}</div></td>
      <td className="px-3 py-3">{row.identity ? <button className="font-semibold text-primary hover:underline" onClick={() => onOpen(row.identity)}>{row.identity.type}{row.identity.type === "Pack" ? ` ${row.identity.packSize}` : ""}</button> : "—"}</td>
      {BUCKETS.map(([key]) => <td key={key} className="px-3 py-3 tabular-nums">{row.buckets[key]}</td>)}
      <td className="px-3 py-3 font-bold tabular-nums">{row.availableNow}</td>
      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${!row.hasPosition ? "bg-slate-200" : row.isZero ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{!row.hasPosition ? "Sans position" : row.isZero ? "Position zéro" : "Active"}</span></td>
    </tr>)}</tbody>
  </table></div>;
}

export function StockDetailPanel({ trace }: { trace: any }) {
  return <div className="space-y-6">
    <section className="space-y-3"><div className="flex items-center gap-2"><ShieldCheck className="text-emerald-600"/><h2 className="text-xl font-bold">Position agrégée</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{trace.reconciliation.status}</span></div><BucketGrid balance={trace.aggregate}/></section>
    <section><h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><MapPin/>Par lieu physique</h2><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/60"><tr><th className="p-3 text-left">Lieu</th><th className="p-3 text-left">Catégorie</th>{BUCKETS.map(([, label]) => <th key={label} className="p-3 text-right">{label}</th>)}</tr></thead><tbody className="divide-y">{trace.locations.map((row: any) => <tr key={row.locationId}><td className="p-3 font-semibold">{locationLabel(row)}</td><td className="p-3">{row.category}</td>{BUCKETS.map(([key]) => <td key={key} className="p-3 text-right tabular-nums">{row.buckets[key]}</td>)}</tr>)}</tbody></table></div></section>
    <section><h2 className="mb-3 text-xl font-bold">Lots et provenance</h2><div className="grid gap-3 md:grid-cols-2">{trace.lots.map((lot: any) => <article key={`${lot.lotId}-${lot.locationId}`} className={`rounded-xl border p-4 ${lot.originKind === "LEGACY_UNKNOWN" ? "border-amber-300 bg-amber-50" : "bg-white"}`}><div className="flex justify-between gap-3"><div><div className="font-bold">{lot.originKind === "LEGACY_UNKNOWN" ? "Legacy / provenance inconnue" : lot.lotCode}</div><div className="text-xs text-muted-foreground">{lot.originKind} · {locationLabel({ code: lot.locationCode })}</div></div><div className="text-xl font-bold">{lot.physicalTotal}</div></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Réception</dt><dd>{lot.receiptCode || "Non documentée"}</dd></div><div><dt className="text-muted-foreground">Fournisseur</dt><dd>{lot.supplierName || "Non documenté"}</dd></div><div><dt className="text-muted-foreground">Date reçue</dt><dd>{lot.receivedAt ? new Date(lot.receivedAt).toLocaleString("fr-CA") : "Inconnue"}</dd></div><div><dt className="text-muted-foreground">Lot ID</dt><dd className="truncate" title={lot.lotId}>{lot.lotId}</dd></div></dl></article>)}</div></section>
  </div>;
}

export function MovementHistory({ history, onOpen }: { history: any; onOpen: (groupId: string) => void }) {
  return <div className="space-y-3">{history.operations.map((operation: any) => <article key={operation.groupId} className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold">{operation.movementType} · {operationQuantity(operation)}</div><div className="text-sm text-muted-foreground">{new Date(operation.movementDate || operation.createdAt).toLocaleString("fr-CA")} · {operation.author}</div></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${operation.allocationConsistency.status === "RECONCILED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{operation.allocationConsistency.status}</span></div><div className="mt-3 grid gap-2 text-sm md:grid-cols-3"><div><span className="text-muted-foreground">Source : </span>{locationLabel(operation.sourceLocation)}</div><div><span className="text-muted-foreground">Destination : </span>{locationLabel(operation.destinationLocation)}</div><div><span className="text-muted-foreground">Référence : </span>{operation.referenceType ? `${operation.referenceType} ${operation.referenceId || operation.referenceLabel || ""}` : "—"}</div></div><button onClick={() => onOpen(operation.groupId)} className="mt-3 text-sm font-semibold text-primary hover:underline">Ouvrir le groupe {operation.groupId}</button></article>)}</div>;
}

export function TraceabilityWarning({ message }: { message: string }) {
  return <div role="alert" className="flex gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-5 font-bold text-red-950"><AlertTriangle className="shrink-0"/>{message}</div>;
}

export function MovementConfirmation({ identity, definition, draft, locations }: { identity: any; definition: any; draft: any; locations: any[] }) {
  return <><h3 className="text-xl font-bold">Confirmer l’opération</h3><p className="mt-2">{stockIdentityLabel(identity)}</p><dl className="mt-4 space-y-2 text-sm"><div><dt className="inline text-muted-foreground">Opération : </dt><dd className="inline font-semibold">{definition.label}</dd></div><div><dt className="inline text-muted-foreground">Quantité : </dt><dd className="inline font-semibold">{draft.qty}{definition.correction ? " (stock compté cible)" : ""}</dd></div>{definition.source && <div><dt className="inline text-muted-foreground">Source : </dt><dd className="inline">{locationLabel(locations.find((row) => row.locationId === draft.sourceLocationId))}</dd></div>}{definition.destination && <div><dt className="inline text-muted-foreground">Destination : </dt><dd className="inline">{locationLabel(locations.find((row) => row.locationId === draft.destinationLocationId))}</dd></div>}</dl></>;
}

function MovementForm({ identity, locations, onSuccess }: { identity: any; locations: any[]; onSuccess: (groupId: string) => void }) {
  const [draft, setDraft] = useState<any>({ movementType: "RECEPTION", qty: 1, sourceLocationId: "", destinationLocationId: "", lotId: "", author: "", referenceType: "", referenceId: "", motif: "", comment: "" });
  const [lots, setLots] = useState<any[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const definition = operationDefinition(draft.movementType);
  const errors = validateMovementDraft(draft);

  useEffect(() => {
    setLots([]); setDraft((current: any) => ({ ...current, lotId: "" }));
    if (draft.movementType !== "RECEPTION" || !draft.destinationLocationId) return;
    const params = new URLSearchParams({ sku: identity.sku, type: identity.type, packSize: String(identity.packSize), destinationLocationId: draft.destinationLocationId });
    stockRequest(`/api/admin/stock/reception-lots?${params}`).then((data) => setLots(data.lots || [])).catch((reason) => setError(operationalErrorMessage(reason.code, reason.message)));
  }, [draft.movementType, draft.destinationLocationId, identity.sku, identity.type, identity.packSize]);

  const update = (key: string, value: string | number) => setDraft((current: any) => ({ ...current, [key]: value }));
  const execute = async () => {
    setBusy(true); setError("");
    const payload: any = { sku: identity.sku, type: identity.type, packSize: identity.packSize, movementType: draft.movementType, qty: Number(draft.qty), author: draft.author.trim() };
    for (const key of ["sourceLocationId", "destinationLocationId", "lotId", "referenceType", "referenceId", "motif", "comment"]) if (draft[key]?.trim()) payload[key] = draft[key].trim();
    try {
      const result = await stockRequest("/api/admin/stock/movements", { method: "POST", body: JSON.stringify(payload) });
      setConfirming(false); onSuccess(result.groupId);
    } catch (reason) {
      const apiError = reason as StockApiError;
      setError(operationalErrorMessage(apiError.code, apiError.message));
    } finally { setBusy(false); }
  };

  return <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Exécuter une opération</h2><p className="mt-1 text-sm text-muted-foreground">Les lots sortants sont alloués automatiquement par FIFO M4. Aucun stock n’est modifié avant confirmation.</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Opération<select value={draft.movementType} onChange={(event) => update("movementType", event.target.value)} className="mt-1 w-full rounded border p-2">{STOCK_ADMIN_OPERATIONS.map((operation) => <option key={operation.value} value={operation.value}>{operation.label}</option>)}</select></label><label className="text-sm font-semibold">{definition.correction ? "Quantité comptée cible" : "Quantité"}<input type="number" min="0" value={draft.qty} onChange={(event) => update("qty", event.target.value)} className="mt-1 w-full rounded border p-2"/></label>
      {definition.source && <label className="text-sm font-semibold">Lieu source<select value={draft.sourceLocationId} onChange={(event) => update("sourceLocationId", event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Sélectionner…</option>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{locationLabel(location)} · {location.category}</option>)}</select></label>}
      {definition.destination && <label className="text-sm font-semibold">Lieu destination<select value={draft.destinationLocationId} onChange={(event) => update("destinationLocationId", event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Sélectionner…</option>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{locationLabel(location)} · {location.category}</option>)}</select></label>}
      {draft.movementType === "RECEPTION" && <label className="text-sm font-semibold">Provenance<select value={draft.lotId} onChange={(event) => update("lotId", event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Legacy / provenance inconnue</option>{lots.map((lot) => <option key={lot.lotId} value={lot.lotId}>{lot.lotCode} · {lot.receiptCode} · {lot.supplierName || "fournisseur non documenté"}</option>)}</select><span className="mt-1 block text-xs text-muted-foreground">Seuls les lots de réception déjà prouvés pour cette identité et ce lieu sont proposés.</span></label>}
      <label className="text-sm font-semibold">Auteur<input value={draft.author} onChange={(event) => update("author", event.target.value)} className="mt-1 w-full rounded border p-2" placeholder="Nom opérateur"/></label>
      <label className="text-sm font-semibold">Type de référence<select value={draft.referenceType} onChange={(event) => update("referenceType", event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Aucune</option>{["CLIENT", "ORDER", "EVENT", "PARTNER", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">ID de référence<input value={draft.referenceId} onChange={(event) => update("referenceId", event.target.value)} className="mt-1 w-full rounded border p-2"/></label>
      <label className="text-sm font-semibold md:col-span-2">{definition.correction ? "Motif obligatoire" : "Motif"}<textarea value={draft.motif} onChange={(event) => update("motif", event.target.value)} className="mt-1 w-full rounded border p-2" rows={2}/></label></div>
    {error && <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</div>}
    {errors.length > 0 && <ul className="mt-4 list-disc pl-5 text-sm text-amber-800">{errors.map((item) => <li key={item}>{item}</li>)}</ul>}
    <button disabled={errors.length > 0 || busy} onClick={() => setConfirming(true)} className="mt-4 rounded bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-40">Vérifier et confirmer</button>
    {confirming && <div role="dialog" aria-label="Confirmation opération stock" className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"><MovementConfirmation identity={identity} definition={definition} draft={draft} locations={locations}/><div className="mt-6 flex justify-end gap-3"><button disabled={busy} onClick={() => setConfirming(false)} className="rounded border px-4 py-2">Annuler</button><button disabled={busy} onClick={execute} className="rounded bg-primary px-4 py-2 font-bold text-primary-foreground">{busy ? "Exécution…" : "Confirmer et exécuter"}</button></div></div></div>}
  </section>;
}

export default function StockAdmin() {
  const [search, setSearch] = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [trace, setTrace] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [movementDetail, setMovementDetail] = useState<any>(null);
  const historyLimit = 20;

  const loadList = useCallback(async () => {
    setLoading(true); setMessage("");
    try { const data = await stockRequest(`/api/admin/stock?search=${encodeURIComponent(search.trim())}`); setPositions(data.positions || []); }
    catch (reason) { const error = reason as StockApiError; setMessage(operationalErrorMessage(error.code, error.message)); }
    finally { setLoading(false); }
  }, [search]);

  const loadTrace = useCallback(async (identity = selected, offset = historyOffset) => {
    if (!identity) return;
    setLoading(true); setWarning("");
    const params = new URLSearchParams({ type: identity.type, packSize: String(identity.packSize), limit: String(historyLimit), offset: String(offset) });
    try { setTrace(await stockRequest(`/api/admin/stock/${encodeURIComponent(identity.sku)}/traceability?${params}`)); }
    catch (reason) { const error = reason as StockApiError; if (error.status === 409) setWarning(operationalErrorMessage(error.code)); else setMessage(operationalErrorMessage(error.code, error.message)); }
    finally { setLoading(false); }
  }, [selected, historyOffset]);

  useEffect(() => { const timer = window.setTimeout(loadList, 250); return () => clearTimeout(timer); }, [loadList]);
  useEffect(() => { stockRequest("/api/admin/stock/locations").then((data) => setLocations(data.locations || [])).catch(() => setMessage("Chargement des lieux impossible.")); }, []);
  useEffect(() => { if (selected) loadTrace(selected, historyOffset); }, [selected, historyOffset]);

  const openIdentity = (identity: any) => { setSelected(identity); setTrace(null); setHistoryOffset(0); setMessage(""); setWarning(""); };
  const refreshAfterWrite = async (groupId: string) => {
    await submitMovementAndRefresh(async () => groupId, async () => Promise.all([loadTrace(selected, 0), loadList()]));
    setHistoryOffset(0); setMessage(`Opération enregistrée. Groupe immutable : ${groupId}`);
  };
  const openMovement = async (groupId: string) => {
    try { setMovementDetail(await stockRequest(`/api/admin/stock/movements/${groupId}`)); }
    catch (reason) { const error = reason as StockApiError; setMessage(operationalErrorMessage(error.code, error.message)); }
  };
  const page = Math.floor(historyOffset / historyLimit) + 1;
  const pages = trace ? Math.max(1, Math.ceil(trace.history.total / historyLimit)) : 1;

  if (selected) return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={() => { setSelected(null); setTrace(null); loadList(); }} className="inline-flex items-center gap-2 font-semibold"><ArrowLeft size={18}/>Retour au stock</button><button onClick={() => loadTrace()} disabled={loading} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-semibold"><RefreshCw size={16}/>Relire le stock</button></div>
    <header><p className="text-sm text-muted-foreground">Stock Central · identité exacte</p><h1 className="text-3xl font-serif font-bold">{stockIdentityLabel(selected)}</h1>{trace?.sku && <p>{[trace.sku.marque, trace.sku.ligne, trace.sku.vitole].filter(Boolean).join(" · ")}</p>}</header>
    {message && <div role="status" className="rounded-lg border border-blue-300 bg-blue-50 p-3 font-semibold text-blue-900">{message}</div>}
    {warning && <TraceabilityWarning message={warning}/>}
    {trace && !warning && <><StockDetailPanel trace={trace}/><MovementForm identity={selected} locations={locations} onSuccess={refreshAfterWrite}/><section><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold"><History/>Historique immutable</h2><span className="text-sm text-muted-foreground">Page {page}/{pages} · {trace.history.total} opérations</span></div><MovementHistory history={trace.history} onOpen={openMovement}/><div className="mt-4 flex justify-end gap-2"><button disabled={historyOffset === 0} onClick={() => setHistoryOffset(Math.max(0, historyOffset - historyLimit))} className="rounded border px-3 py-2 disabled:opacity-40">Précédent</button><button disabled={historyOffset + historyLimit >= trace.history.total} onClick={() => setHistoryOffset(historyOffset + historyLimit)} className="rounded border px-3 py-2 disabled:opacity-40">Suivant</button></div></section></>}
    {loading && <div className="text-sm text-muted-foreground">Lecture du backend…</div>}
    {movementDetail && <div role="dialog" aria-label="Détail groupe de mouvement" className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{movementDetail.movementType}</h2><p className="text-xs text-muted-foreground">{movementDetail.groupId}</p></div><button onClick={() => setMovementDetail(null)}><X/></button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded border p-3"><strong>Détails ledger</strong>{movementDetail.details.map((row: any) => <div key={row.id} className="mt-2 text-sm">{row.balanceField}: {row.qtyBefore} → {row.qtyAfter} ({row.qtyDelta > 0 ? "+" : ""}{row.qtyDelta})</div>)}</div><div className="rounded border p-3"><strong>Allocations lots</strong>{movementDetail.lotAllocations.map((row: any) => <div key={row.id} className="mt-2 text-sm">{row.lotCode} · {row.locationCode}: {row.qtyDelta > 0 ? "+" : ""}{row.qtyDelta} {row.balanceField}</div>)}</div></div></div></div>}
  </div>;

  return <div className="mx-auto max-w-7xl space-y-6 pb-12"><header><p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Back-office opérationnel</p><h1 className="text-3xl font-serif font-bold">Stock Central</h1><p className="mt-1 text-muted-foreground">Inspecter ce que CitiCigars détient, où cela se trouve et d’où cela vient.</p></header><div className="relative max-w-2xl"><Search className="absolute left-3 top-3 text-muted-foreground" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 shadow-sm" placeholder="Rechercher SKU, marque, ligne ou vitole…"/></div>{message && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">{message}</div>}<StockPositionsTable positions={positions} onOpen={openIdentity}/>{loading && <div className="text-sm text-muted-foreground">Recherche…</div>}<div className="text-xs text-muted-foreground">Maximum 100 lignes. Les SKU sans position sont affichés explicitement; ouvrez une identité matérialisée pour agir.</div></div>;
}
