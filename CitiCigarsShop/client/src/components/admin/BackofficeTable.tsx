import React, { useMemo, useState } from "react";
export type Column = {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
};
export const amount = (value: any) =>
  value == null
    ? "Inconnu"
    : Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 4 });
export const dateLabel = (value: any) =>
  !value
    ? "Date inconnue"
    : /^\d{4}-\d{2}$/.test(String(value))
      ? `${value} (mois connu)`
      : new Date(value).toLocaleDateString("fr-CA", { timeZone: "UTC" });
export function AuditProof({ value }: { value: any }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-muted-foreground">
        Preuve source / identifiants techniques
      </summary>
      <pre className="mt-2 max-h-96 overflow-auto rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
export default function BackofficeTable({
  rows,
  columns,
  label = "Rechercher",
}: {
  rows: any[];
  columns: Column[];
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState({ key: columns[0]?.key, dir: 1 });
  const result = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            JSON.stringify(row)
              .toLocaleLowerCase()
              .includes(search.toLocaleLowerCase()) &&
            Object.entries(filters).every(([key, value]) =>
              String(row[key] ?? "")
                .toLocaleLowerCase()
                .includes(value.toLocaleLowerCase()),
            ),
        )
        .sort((a, b) => {
          const x = a[sort.key],
            y = b[sort.key];
          if (x == null) return y == null ? 0 : 1;
          if (y == null) return -1;
          return (
            sort.dir *
            (typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y), "fr", { numeric: true }))
          );
        }),
    [rows, search, sort, filters],
  );
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        {label}
        <input
          className="ml-3 rounded border p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {result.length} résultat(s)
      </p>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="p-3 text-left whitespace-nowrap"
                  aria-sort={
                    sort.key === c.key
                      ? sort.dir === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    onClick={() =>
                      setSort({
                        key: c.key,
                        dir: sort.key === c.key ? -sort.dir : 1,
                      })
                    }
                  >
                    {c.label}{" "}
                    {sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}
                  </button>
                  <input
                    aria-label={`Filtrer ${c.label}`}
                    className="mt-2 block w-24 rounded border px-2 py-1 text-xs font-normal"
                    value={filters[c.key] || ""}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, [c.key]: e.target.value }))
                    }
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.map((row, i) => (
              <tr key={row.id ?? i} className="border-t align-top">
                {columns.map((c) => (
                  <td key={c.key} className="p-3">
                    {c.render ? c.render(row) : (row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!result.length && (
          <p className="p-6 text-muted-foreground">
            Aucune donnée dans ce périmètre.
          </p>
        )}
      </div>
    </div>
  );
}
