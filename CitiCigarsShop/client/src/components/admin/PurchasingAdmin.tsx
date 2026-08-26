import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/config";

function authenticatedFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", "x-cms-token": sessionStorage.getItem("cms_token") || "", ...(options.headers || {}) } });
}

const today = () => new Date().toISOString().slice(0, 10);
const requestId = () => crypto.randomUUID();
const identity = (line: any) => `${line.sku} · ${line.type}${line.type === "Pack" ? `(${line.packSize})` : ""}`;
const emptyPoLine = () => ({ sku: "", type: "Box", packSize: 0, orderedQuantity: 1 });

async function api(path: string, options: RequestInit = {}) {
  const response = await authenticatedFetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "Opération achats impossible");
  return body;
}

export function PurchaseOrderProgress({ order }: { order: any }) {
  return <div className="space-y-2">{order.items.map((item: any) => <div key={item.purchaseOrderItemId} className="rounded border p-2 text-sm">
    <strong>{identity(item)}</strong><span className="ml-2">commandé {item.orderedQuantity} · reçu {item.receivedQuantity} · restant {item.outstandingQuantity}</span>
  </div>)}</div>;
}

export function ReceiptConfirmation({ order, destination, lines }: { order: any; destination: any; lines: any[] }) {
  return <div><h3 className="text-lg font-bold">Confirmer la réception</h3>
    <p className="mt-1 text-sm">{order.purchaseOrderCode} · {order.supplierCode} — {order.supplierName}</p>
    <p className="text-sm">Destination : {destination?.code} — {destination?.name}</p>
    <ul className="mt-3 space-y-1 text-sm">{lines.filter((line) => Number(line.receivedQuantity) > 0).map((line) => <li key={line.purchaseOrderItemId}>{identity(line)} : +{line.receivedQuantity}</li>)}</ul>
    <p className="mt-3 text-xs text-amber-800">Un lot de provenance neuf sera créé par ligne. Aucune augmentation optimiste n’est affichée.</p>
  </div>;
}

export default function PurchasingAdmin() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [supplierDraft, setSupplierDraft] = useState({ code: "", name: "" });
  const [poDraft, setPoDraft] = useState<any>({ supplierId: "", orderedAt: today(), expectedAt: "", purchaseReference: "", createdBy: "", lines: [emptyPoLine()] });
  const [poRequestId, setPoRequestId] = useState(requestId);
  const [receiptDraft, setReceiptDraft] = useState<any>({ destinationLocationId: "", receivedAt: today(), author: "", invoiceReference: "", shipmentReference: "", lines: [] });
  const [receiptRequestId, setReceiptRequestId] = useState(requestId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [supplierData, orderData, receiptData, productData, locationData] = await Promise.all([
      api("/api/admin/purchasing/suppliers"), api("/api/admin/purchasing/orders"), api("/api/admin/purchasing/receipts"),
      api("/api/products"), api("/api/admin/stock/locations"),
    ]);
    setSuppliers(supplierData.suppliers || []); setOrders(orderData.orders || []); setReceipts(receiptData.receipts || []);
    setProducts(productData || []); setLocations(locationData.locations || []);
  }, []);
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [load]);

  const selectedOrder = useMemo(() => orders.find((order) => order.purchaseOrderId === selectedOrderId), [orders, selectedOrderId]);
  useEffect(() => {
    if (!selectedOrder) return setReceiptDraft((draft: any) => ({ ...draft, lines: [] }));
    setReceiptDraft((draft: any) => ({ ...draft, lines: selectedOrder.items.filter((item: any) => item.outstandingQuantity > 0).map((item: any) => ({ ...item, receivedQuantity: 0 })) }));
  }, [selectedOrder]);

  const mutate = async (action: () => Promise<any>, success: (result: any) => Promise<void> | void) => {
    setBusy(true); setError(""); setMessage("");
    try { const result = await action(); await success(result); await load(); } catch (reason: any) { setError(reason.message); } finally { setBusy(false); }
  };

  const createSupplier = () => mutate(
    () => api("/api/admin/purchasing/suppliers", { method: "POST", body: JSON.stringify(supplierDraft) }),
    (result) => { setMessage(`Fournisseur ${result.code} créé.`); setSupplierDraft({ code: "", name: "" }); },
  );

  const createOrder = () => mutate(
    () => api("/api/admin/purchasing/orders", { method: "POST", body: JSON.stringify({
      ...poDraft, clientRequestId: poRequestId, orderedAt: `${poDraft.orderedAt}T12:00:00.000Z`,
      expectedAt: poDraft.expectedAt ? `${poDraft.expectedAt}T12:00:00.000Z` : null,
      lines: poDraft.lines.map((line: any) => ({ ...line, packSize: Number(line.packSize), orderedQuantity: Number(line.orderedQuantity) })),
    }) }),
    (result) => { setMessage(`${result.purchaseOrderCode} créé.`); setSelectedOrderId(result.purchaseOrderId); setPoRequestId(requestId()); setPoDraft((draft: any) => ({ ...draft, lines: [emptyPoLine()] })); },
  );

  const submitReceipt = () => mutate(
    () => api("/api/admin/purchasing/receipts", { method: "POST", body: JSON.stringify({
      ...receiptDraft, clientRequestId: receiptRequestId, purchaseOrderId: selectedOrderId,
      receivedAt: `${receiptDraft.receivedAt}T12:00:00.000Z`,
      lines: receiptDraft.lines.filter((line: any) => Number(line.receivedQuantity) > 0).map((line: any) => ({
        purchaseOrderItemId: line.purchaseOrderItemId, sku: line.sku, type: line.type, packSize: line.packSize, receivedQuantity: Number(line.receivedQuantity),
      })),
    }) }),
    async (result) => {
      await Promise.all(result.items.map((item: any) => api(`/api/admin/stock?search=${encodeURIComponent(item.sku)}`)));
      setMessage(`${result.receiptCode} confirmé; ${result.items.length} lot(s), groupes ${result.items.map((item: any) => item.stockMovementGroupId).join(", ")}. Stock Central relu.`);
      setReceiptRequestId(requestId()); setConfirming(false);
    },
  );

  const updatePoLine = (index: number, key: string, value: any) => setPoDraft((draft: any) => ({ ...draft, lines: draft.lines.map((line: any, current: number) => current === index ? { ...line, [key]: value } : line) }));
  const destination = locations.find((location) => location.locationId === receiptDraft.destinationLocationId);
  const receiptReady = selectedOrder && receiptDraft.destinationLocationId && receiptDraft.author.trim() && receiptDraft.lines.some((line: any) => Number(line.receivedQuantity) > 0);

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header><p className="text-sm text-muted-foreground">Stock Central · amont prouvé</p><h1 className="text-3xl font-serif font-bold">Achats & Réceptions</h1><p>Fournisseur → bon de commande → reçu → lots → réception M4.</p></header>
    {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">{error}</div>}
    {message && <div role="status" className="rounded border border-green-300 bg-green-50 p-3 text-green-900">{message}</div>}

    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Fournisseurs</h2>
      <div className="mt-3 flex flex-wrap gap-2"><input placeholder="Code" value={supplierDraft.code} onChange={(e) => setSupplierDraft({ ...supplierDraft, code: e.target.value })} className="rounded border p-2"/><input placeholder="Nom" value={supplierDraft.name} onChange={(e) => setSupplierDraft({ ...supplierDraft, name: e.target.value })} className="min-w-64 rounded border p-2"/><button disabled={busy || !supplierDraft.code || !supplierDraft.name} onClick={createSupplier} className="rounded bg-primary px-4 py-2 text-white disabled:opacity-40">Créer</button></div>
      <div className="mt-3 text-sm">{suppliers.map((supplier) => <span key={supplier.supplierId} className="mr-3 inline-block">{supplier.code} — {supplier.name}{!supplier.active ? " (inactif)" : ""}</span>)}</div>
    </section>

    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Nouveau bon de commande</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-4"><select value={poDraft.supplierId} onChange={(e) => setPoDraft({ ...poDraft, supplierId: e.target.value })} className="rounded border p-2"><option value="">Fournisseur *</option>{suppliers.filter((s) => s.active).map((s) => <option key={s.supplierId} value={s.supplierId}>{s.code} — {s.name}</option>)}</select><input type="date" value={poDraft.orderedAt} onChange={(e) => setPoDraft({ ...poDraft, orderedAt: e.target.value })} className="rounded border p-2"/><input type="date" value={poDraft.expectedAt} onChange={(e) => setPoDraft({ ...poDraft, expectedAt: e.target.value })} className="rounded border p-2"/><input placeholder="Créé par *" value={poDraft.createdBy} onChange={(e) => setPoDraft({ ...poDraft, createdBy: e.target.value })} className="rounded border p-2"/></div>
      <div className="mt-4 space-y-2">{poDraft.lines.map((line: any, index: number) => <div key={index} className="grid gap-2 rounded border p-2 md:grid-cols-5"><select value={line.sku} onChange={(e) => updatePoLine(index, "sku", e.target.value)} className="rounded border p-2"><option value="">SKU *</option>{products.map((p) => <option key={p.sku}>{p.sku}</option>)}</select><select value={line.type} onChange={(e) => updatePoLine(index, "type", e.target.value)} className="rounded border p-2">{["Box","Pack","Loose","Accessory"].map((type) => <option key={type}>{type}</option>)}</select><input type="number" min="0" value={line.packSize} onChange={(e) => updatePoLine(index, "packSize", e.target.value)} className="rounded border p-2" aria-label="Pack size"/><input type="number" min="1" value={line.orderedQuantity} onChange={(e) => updatePoLine(index, "orderedQuantity", e.target.value)} className="rounded border p-2" aria-label="Quantité commandée"/>{poDraft.lines.length > 1 && <button onClick={() => setPoDraft((draft: any) => ({ ...draft, lines: draft.lines.filter((_: any, i: number) => i !== index) }))}>Retirer</button>}</div>)}</div>
      <div className="mt-3 flex gap-2"><button onClick={() => setPoDraft((draft: any) => ({ ...draft, lines: [...draft.lines, emptyPoLine()] }))} className="rounded border px-3 py-2">Ajouter une ligne</button><button disabled={busy || !poDraft.supplierId || !poDraft.createdBy || poDraft.lines.some((line: any) => !line.sku)} onClick={createOrder} className="rounded bg-primary px-4 py-2 text-white disabled:opacity-40">Créer le PO</button></div>
    </section>

    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Recevoir un PO</h2>
      <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="mt-3 w-full rounded border p-2"><option value="">Sélectionner un PO ouvert…</option>{orders.filter((order) => ["ORDERED","PARTIALLY_RECEIVED"].includes(order.status)).map((order) => <option key={order.purchaseOrderId} value={order.purchaseOrderId}>{order.purchaseOrderCode} · {order.supplierCode} · {order.status}</option>)}</select>
      {selectedOrder && <div className="mt-4 space-y-4"><PurchaseOrderProgress order={selectedOrder}/><div className="grid gap-3 md:grid-cols-3"><select value={receiptDraft.destinationLocationId} onChange={(e) => setReceiptDraft({ ...receiptDraft, destinationLocationId: e.target.value })} className="rounded border p-2"><option value="">Destination *</option>{locations.map((location) => <option key={location.locationId} value={location.locationId}>{location.code} — {location.name} · {location.category}</option>)}</select><input type="date" value={receiptDraft.receivedAt} onChange={(e) => setReceiptDraft({ ...receiptDraft, receivedAt: e.target.value })} className="rounded border p-2"/><input placeholder="Auteur *" value={receiptDraft.author} onChange={(e) => setReceiptDraft({ ...receiptDraft, author: e.target.value })} className="rounded border p-2"/></div>
        {receiptDraft.lines.map((line: any, index: number) => <label key={line.purchaseOrderItemId} className="grid grid-cols-2 items-center gap-3 rounded border p-3 text-sm"><span>{identity(line)} · restant {line.outstandingQuantity}</span><input type="number" min="0" max={line.outstandingQuantity} value={line.receivedQuantity} onChange={(e) => setReceiptDraft((draft: any) => ({ ...draft, lines: draft.lines.map((item: any, current: number) => current === index ? { ...item, receivedQuantity: e.target.value } : item) }))} className="rounded border p-2" aria-label={`Quantité reçue ${line.sku}`}/></label>)}
        <button disabled={busy || !receiptReady} onClick={() => setConfirming(true)} className="rounded bg-primary px-4 py-2 text-white disabled:opacity-40">Vérifier et confirmer</button></div>}
    </section>

    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">Historique des réceptions</h2><div className="mt-3 space-y-2">{receipts.map((receipt) => <div key={receipt.receiptId} className="rounded border p-3 text-sm"><strong>{receipt.receiptCode}</strong> · {receipt.supplierCode} · {receipt.destinationCode} · {new Date(receipt.receivedAt).toLocaleDateString("fr-FR")}<div>{receipt.items.map((item: any) => `${identity(item)} +${item.quantity} · ${item.lotCode}`).join(" | ")}</div></div>)}</div></section>

    {confirming && selectedOrder && <div role="dialog" aria-label="Confirmation réception" className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div className="w-full max-w-xl rounded bg-white p-6"><ReceiptConfirmation order={selectedOrder} destination={destination} lines={receiptDraft.lines}/><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirming(false)} className="rounded border px-4 py-2">Annuler</button><button disabled={busy} onClick={submitReceipt} className="rounded bg-primary px-4 py-2 text-white">Confirmer et recevoir</button></div></div></div>}
  </div>;
}
