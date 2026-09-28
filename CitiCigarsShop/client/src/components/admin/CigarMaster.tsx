import React, { useEffect, useState } from "react";
import BackofficeTable, { AuditProof } from "./BackofficeTable";
import { crmFetch } from "./crm/crmApi";
export default function CigarMaster() {
  const [rows, setRows] = useState<any[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    crmFetch("/api/admin/backoffice/identities")
      .then(async (r) => {
        if (!r.ok) throw new Error("Référentiel indisponible");
        return r.json();
      })
      .then((d) => {
        if (active) setRows(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-serif font-bold">Cigar Master</h1>
      <h2 className="text-lg font-semibold">Identification</h2>
      <p className="text-sm text-muted-foreground">
        Une ligne par identité permanente, indépendante du stock. Les SKU liés
        désignent les objets stockables.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows ? (
        <BackofficeTable
          rows={rows}
          columns={[
            { key: "marque", label: "Marque" },
            { key: "ligne", label: "Ligne / Série" },
            { key: "vitole", label: "Vitole" },
            { key: "format", label: "Format" },
            { key: "dimensions", label: "Dimensions" },
            { key: "pays", label: "Pays" },
            {
              key: "cigar_id",
              label: "Référence interne",
              render: (r) => (
                <details>
                  <summary>Identité et liens</summary>
                  <p>{r.cigar_id}</p>
                  {r.skus.map((s: any) => (
                    <p key={s.sku}>
                      {s.sku} · {s.cigars_per_box ?? "Non documenté"} / boîte
                    </p>
                  ))}
                  <AuditProof value={r} />
                </details>
              ),
            },
          ]}
        />
      ) : (
        !error && <p>Chargement…</p>
      )}
    </div>
  );
}
