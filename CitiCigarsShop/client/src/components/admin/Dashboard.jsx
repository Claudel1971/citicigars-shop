import React, { useEffect, useState } from "react";
import { crmFetch } from "./crm/crmApi";
import BackofficeTable, { amount, dateLabel } from "./BackofficeTable";
export default function Dashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    crmFetch("/api/admin/backoffice/dashboard")
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 403
              ? "Accès non autorisé."
              : "Tableau de bord indisponible.",
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
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Chargement des données réelles…</p>;
  const stats = [
    ["Stock détenu", data.stock.held],
    ["Stock en dépôt", data.stock.deposit],
    ["CA net · FCFA", data.finance.revenue],
    ["Encaissé · FCFA", data.finance.cash],
    ["Créances · FCFA", data.finance.receivable],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold">Tableau de bord</h1>
      <p className="text-sm text-muted-foreground">{data.scope}</p>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-bold">{amount(value)}</div>
          </div>
        ))}
      </div>
      <p className="text-sm">
        {data.stockUnit} {data.heldFormula}
      </p>
      <h2 className="text-xl font-semibold">Transactions récentes</h2>
      <BackofficeTable
        rows={data.activity}
        columns={[
          { key: "date", label: "Date", render: (r) => dateLabel(r.date) },
          { key: "reference", label: "Référence" },
          {
            key: "amount",
            label: "CA net · FCFA",
            render: (r) => amount(r.amount),
          },
        ]}
      />
      <h2 className="text-xl font-semibold">
        Articles les plus mouvementés en vente — historique
      </h2>
      <BackofficeTable
        rows={data.top}
        columns={[
          { key: "brand", label: "Marque" },
          { key: "series", label: "Ligne / Série" },
          { key: "vitole", label: "Vitole" },
          {
            key: "quantity",
            label: "Objets comptabilisés",
            render: (r) => amount(r.quantity),
          },
          {
            key: "orders",
            label: "Commandes",
            render: (r) => amount(r.orders),
          },
        ]}
      />
    </div>
  );
}
