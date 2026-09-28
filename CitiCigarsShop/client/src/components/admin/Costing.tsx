import React, { useEffect, useState } from "react";
import { crmFetch } from "./crm/crmApi";
import BackofficeTable, {
  amount,
  dateLabel,
  AuditProof,
  type Column,
} from "./BackofficeTable";
import HistoricalAudit from "./crm/HistoricalAudit";
const tabs = [
  "Vue d’ensemble",
  "Coût du stock",
  "Marges",
  "Landing Cost / Lots",
  "Fournisseurs",
  "Consignations",
];
const knownSum = (values: any[]) =>
  !values.length || values.some((v) => v == null)
    ? null
    : values.reduce((s, v) => s + Number(v), 0);
const money = (key: string, label: string): Column => ({
  key,
  label,
  render: (r) => amount(r[key]),
});
export default function Costing() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState(tabs[0]),
    [trace, setTrace] = useState<any>(null);
  useEffect(() => {
    let active = true;
    crmFetch("/api/admin/backoffice/costing")
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 403 ? "Accès réservé à CT." : "Costing indisponible.",
          );
        return r.json();
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function openOrder(id: string) {
    setTrace(null);
    setError("");
    try {
      const r = await crmFetch(
        `/api/admin/backoffice/costing/orders/${encodeURIComponent(id)}`,
      );
      if (!r.ok) throw new Error("Traçabilité indisponible");
      setTrace(await r.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Chargement du Costing…"}
      </p>
    );
  const inventory = data.inventory.map((r: any) => ({
    ...r,
    packaging:
      (
        {
          Box: "Boîte",
          Pack: r.sku.startsWith("CTCG-BDL-") ? "Bundle" : "Pack",
          Loose: "Vrac",
          Accessory: "Accessoire",
        } as any
      )[r.type] || r.type,
    perPack:
      r.type === "Pack" ? r.pack_size : r.type === "Box" ? r.cigars_per_box : 1,
    value:
      r.unit_cost_xaf == null
        ? null
        : Number(r.unit_cost_xaf) * Number(r.quantity),
  }));
  const purchases = data.purchases.map((r: any) => ({
    ...r,
    ...r.identity,
    gross: r.source?.gross_total ?? r.source?.gross ?? null,
    discount: r.source?.discount_total ?? r.source?.discount ?? null,
    net: r.source?.net_total ?? r.source?.net ?? null,
    currency: r.source?.currency ?? null,
    packaging:
      (
        {
          Box: "Boîte",
          Pack: r.sku.startsWith("CTCG-BDL-") ? "Bundle" : "Pack",
          Loose: "Vrac",
          Accessory: "Accessoire",
        } as any
      )[r.type] || r.type,
    perPack:
      r.type === "Pack"
        ? r.packSize
        : r.type === "Box"
          ? r.identity?.cigars_per_box
          : 1,
    unitPurchase:
      (r.source?.net_total ?? r.source?.net) == null || !r.quantity
        ? null
        : Number(r.source?.net_total ?? r.source?.net) / r.quantity,
    dimension:
      [r.identity?.longueur, r.identity?.diametre]
        .filter(Boolean)
        .join(" × ") || null,
  }));
  const supplierNames = Array.from(
    new Set<string>(purchases.map((p: any) => p.supplier)),
  );
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-serif font-bold">Costing</h1>
      <p className="text-sm text-muted-foreground">
        Accès CT · lecture des coûts canoniques. Un coût incomplet reste inconnu
        ; aucune réécriture du FIFO.
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Costing">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setTrace(null);
            }}
            className={`rounded border px-4 py-2 ${tab === t ? "bg-primary text-white" : "bg-white"}`}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {tab === tabs[0] && (
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded border bg-white p-5">
            <h2>Valeur du stock · FCFA</h2>
            <strong className="text-2xl">
              {amount(knownSum(inventory.map((r: any) => r.value)))}
            </strong>
            <p>
              {inventory.filter((r: any) => r.value == null).length} lot(s) sans
              coût documenté.
            </p>
          </article>
          <article className="rounded border bg-white p-5">
            <h2>Transactions historiques</h2>
            <strong className="text-2xl">{data.sales.length}</strong>
          </article>
          <article className="rounded border bg-white p-5">
            <h2>CMV incomplet</h2>
            <strong className="text-2xl">
              {data.sales.filter((r: any) => r.total_cost_xaf == null).length}
            </strong>
          </article>
        </div>
      )}
      {tab === tabs[1] && (
        <BackofficeTable
          rows={inventory}
          columns={[
            { key: "marque", label: "Marque" },
            { key: "ligne", label: "Ligne / Série" },
            { key: "vitole", label: "Vitole" },
            { key: "packaging", label: "Conditionnement" },
            money("perPack", "Qté / conditionnement"),
            money("quantity", "Objets détenus"),
            money("unit_cost_xaf", "C.U. rendu · FCFA"),
            {
              key: "value",
              label: "Valeur · FCFA",
              render: (r) => (
                <>
                  {amount(r.value)}
                  <AuditProof value={r} />
                </>
              ),
            },
          ]}
        />
      )}
      {tab === tabs[2] && (
        <BackofficeTable
          rows={data.sales}
          columns={[
            {
              key: "order_date",
              label: "Date",
              render: (r) => dateLabel(r.order_date),
            },
            { key: "order_id", label: "Vente" },
            money("articles", "# Articles commandés"),
            money("final_sale_total_xaf", "CA net · FCFA"),
            {
              key: "total_cost_xaf",
              label: "CMV · FCFA",
              render: (r) => (
                <button
                  className="text-primary underline"
                  onClick={() => openOrder(r.order_id)}
                >
                  {amount(r.total_cost_xaf)} · Détail
                </button>
              ),
            },
            money("gross_margin_xaf", "Marge · FCFA"),
          ]}
        />
      )}
      {tab === tabs[3] && (
        <>
          <p className="text-sm">
            Les frais, conversions et dates sont ceux documentés à l’import. Une
            composante absente n’est pas assimilée à zéro.
          </p>
          <BackofficeTable
            rows={purchases}
            columns={[
              { key: "supplier", label: "Fournisseur" },
              { key: "date", label: "Date", render: (r) => dateLabel(r.date) },
              { key: "marque", label: "Marque" },
              { key: "ligne", label: "Ligne / Série" },
              { key: "vitole", label: "Vitole" },
              { key: "format", label: "Format" },
              { key: "dimension", label: "Dimension" },
              { key: "packaging", label: "Conditionnement" },
              money("perPack", "# cigares / conditionnement"),
              money("quantity", "Qté conditionnements"),
              money("gross", "Coût brut"),
              money("discount", "Remise"),
              money("net", "Coût net"),
              money("unitPurchase", "C.U. devise d’achat"),
              { key: "currency", label: "Devise" },
              {
                key: "landedUnitCostXaf",
                label: "C.U. rendu · FCFA",
                render: (r) => (
                  <>
                    {amount(r.landedUnitCostXaf)}
                    <AuditProof value={r} />
                  </>
                ),
              },
            ]}
          />
        </>
      )}
      {tab === tabs[4] && (
        <BackofficeTable
          rows={supplierNames.map((s) => ({
            supplier: s,
            lines: purchases.filter((p: any) => p.supplier === s).length,
            value: knownSum(
              purchases
                .filter((p: any) => p.supplier === s)
                .map((p: any) => p.landedTotalXaf),
            ),
          }))}
          columns={[
            { key: "supplier", label: "Fournisseur" },
            money("lines", "Lignes documentées"),
            money("value", "Coût rendu documenté · FCFA"),
          ]}
        />
      )}
      {tab === tabs[5] && <HistoricalAudit />}
      {trace && (
        <section className="rounded-xl border bg-white p-5 space-y-4">
          <div className="flex justify-between">
            <h2 className="text-xl font-bold">CMV · {trace.orderId}</h2>
            <button onClick={() => setTrace(null)}>Fermer</button>
          </div>
          <BackofficeTable
            rows={trace.lines}
            columns={[
              { key: "brand", label: "Marque" },
              { key: "series", label: "Ligne / Série" },
              { key: "vitole", label: "Vitole" },
              money("quantity", "Quantité"),
              {
                key: "total_cost_xaf",
                label: "CMV ligne · FCFA",
                render: (r) => (
                  <>
                    {amount(r.total_cost_xaf)}
                    <AuditProof value={r} />
                  </>
                ),
              },
            ]}
          />
          <h3 className="font-bold">Lots consommés</h3>
          <BackofficeTable
            rows={trace.allocations.map((a: any) => ({
              ...a,
              lot: trace.lots.find((l: any) => l.lot_id === a.lot_id)?.lot_code,
              contribution:
                a.unit_cost_xaf == null
                  ? null
                  : Number(a.consumed) * Number(a.unit_cost_xaf),
            }))}
            columns={[
              { key: "lot", label: "Lot" },
              money("consumed", "Quantité consommée"),
              money("unit_cost_xaf", "C.U. · FCFA"),
              money("contribution", "Contribution CMV · FCFA"),
            ]}
          />
          {trace.lots.map((lot: any) => (
            <details key={lot.lot_id} className="border rounded p-3">
              <summary className="cursor-pointer font-semibold">
                {lot.lot_code} ·{" "}
                {lot.supplier || "Origine transformée / non documentée"}
              </summary>
              <p>
                Réception : {dateLabel(lot.received_at)} · Facture :{" "}
                {lot.invoice_reference || "Non documentée"}
              </p>
              {lot.provenance?.recipe && (
                <BackofficeTable
                  rows={lot.provenance.recipe}
                  columns={[
                    { key: "sku", label: "Composant source" },
                    money("quantity", "Quantité par objet"),
                  ]}
                />
              )}
              {lot.purchaseSource && (
                <div className="mt-3 rounded bg-slate-50 p-3">
                  <h4 className="font-semibold">
                    Construction du coût d’achat
                  </h4>
                  <p>
                    Date source : {dateLabel(lot.purchaseSource.date)} ·{" "}
                    {lot.purchaseSource.quantity} conditionnement(s)
                  </p>
                  <p>
                    Brut :{" "}
                    {amount(
                      lot.purchaseSource.money?.gross_total ??
                        lot.purchaseSource.money?.gross,
                    )}{" "}
                    · Remise :{" "}
                    {amount(
                      lot.purchaseSource.money?.discount_total ??
                        lot.purchaseSource.money?.discount,
                    )}{" "}
                    · Net :{" "}
                    {amount(
                      lot.purchaseSource.money?.net_total ??
                        lot.purchaseSource.money?.net,
                    )}{" "}
                    {lot.purchaseSource.money?.currency}
                  </p>
                  <p>
                    Règlement carte :{" "}
                    {amount(lot.purchaseSource.money?.payment_total)}{" "}
                    {lot.purchaseSource.money?.payment_currency} · Net FCFA :{" "}
                    {amount(
                      lot.purchaseSource.money?.net_total_xaf ??
                        lot.purchaseSource.money?.net_xaf,
                    )}
                  </p>
                  <p>
                    C.U. rendu : {amount(lot.purchaseSource.landedUnitCostXaf)}{" "}
                    FCFA
                  </p>
                  <AuditProof value={lot.purchaseSource} />
                </div>
              )}
              <AuditProof value={lot} />
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
