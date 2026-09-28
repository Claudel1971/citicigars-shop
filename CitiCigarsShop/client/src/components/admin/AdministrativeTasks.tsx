import React, { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { crmFetch } from "./crm/crmApi";
import { dateLabel } from "./BackofficeTable";
export const categories: Record<string, string> = {
  CONTACT_VERIFICATION: "Vérifier les coordonnées administratives",
  ADMIN_DOCUMENT: "Obtenir un document administratif",
  ACCOUNT_RECONCILIATION: "Rapprocher le compte client",
};
export default function AdministrativeTasks({
  customerId,
  compact = false,
}: {
  customerId?: string;
  compact?: boolean;
}) {
  const [tasks, setTasks] = useState<any[]>([]),
    [status, setStatus] = useState("OPEN"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [dueAt, setDueAt] = useState(""),
    [responsible, setResponsible] = useState(""),
    [category, setCategory] = useState("CONTACT_VERIFICATION");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await crmFetch(
        "/api/admin/internal/tasks" +
          (customerId ? "?customerId=" + encodeURIComponent(customerId) : ""),
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTasks(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);
  useEffect(() => {
    load();
  }, [load]);
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Douala",
  });
  async function write(task?: any, next?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await crmFetch(
        "/api/admin/internal/tasks" + (task ? "/" + task.taskId : ""),
        {
          method: task ? "PUT" : "POST",
          body: JSON.stringify(
            task
              ? { status: next, version: task.version }
              : { customerId, category, dueAt, responsible },
          ),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const rows = tasks.filter(
    (t) =>
      t.status === status &&
      (!compact || String(t.dueAt).slice(0, 10) <= today),
  );
  return (
    <section className="border rounded p-4 space-y-3">
      <h2 className="text-xl font-semibold">
        {compact ? "Tâches administratives dues" : "Relances administratives"}
      </h2>
      {!compact && (
        <div className="flex gap-2">
          {[
            ["OPEN", "Ouvertes"],
            ["DONE", "Terminées"],
            ["CANCELLED", "Annulées"],
          ].map(([s, label]) => (
            <button
              className={`border p-2 rounded ${status === s ? "bg-primary text-white" : ""}`}
              key={s}
              onClick={() => setStatus(s)}
            >
              {label}
            </button>
          ))}
          {customerId && (
            <button
              className="border rounded p-2"
              onClick={() => setOpen(!open)}
            >
              + Nouvelle relance administrative
            </button>
          )}
        </div>
      )}
      {open && (
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            write();
          }}
        >
          <label>
            Action
            <select
              className="border p-2 w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(categories).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Échéance
            <input
              required
              type="date"
              className="border p-2 w-full"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </label>
          <label>
            Responsable
            <input
              required
              maxLength={100}
              className="border p-2 w-full"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
            />
          </label>
          <button disabled={busy} className="border p-2">
            Créer
          </button>
        </form>
      )}
      {loading && <p>Chargement…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error} <button onClick={load}>Réessayer</button>
        </p>
      )}
      {!loading && !error && !rows.length && (
        <p>Aucune tâche dans cette vue.</p>
      )}
      {!error &&
        rows.map((t) => (
          <div
            key={t.taskId}
            className="border-t pt-3 flex flex-wrap justify-between gap-3"
          >
            <div>
              <Link href={"/admin/crm/" + t.customerId}>
                {[t.lastName, t.firstName].filter(Boolean).join(" ") ||
                  t.businessId ||
                  "Fiche client"}
              </Link>
              <p>{categories[t.category]}</p>
              <p className="text-sm">
                {dateLabel(t.dueAt)}
                {t.status === "OPEN" && String(t.dueAt).slice(0, 10) < today
                  ? " · En retard"
                  : ""}{" "}
                · Responsable : {t.responsible}
              </p>
            </div>
            <div className="flex gap-2">
              {(t.status === "OPEN"
                ? [
                    ["DONE", "Fait"],
                    ["CANCELLED", "Annuler"],
                  ]
                : [["OPEN", "Réouvrir"]]
              ).map(([s, l]) => (
                <button
                  disabled={busy}
                  className="border rounded p-2"
                  key={s}
                  onClick={() => write(t, s)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ))}
    </section>
  );
}
