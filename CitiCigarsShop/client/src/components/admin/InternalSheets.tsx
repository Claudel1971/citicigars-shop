import React, { useEffect, useState } from "react";
import { crmFetch } from "./crm/crmApi";
import { dateLabel } from "./BackofficeTable";
const labels: Record<string, string> = {
  origin: "Origine",
  wrapper: "Cape",
  binder: "Sous-cape",
  filler: "Tripe",
  format: "Format",
  dimensions: "Dimensions",
};
export default function InternalSheets() {
  const [tab, setTab] = useState("Consultation"),
    [identities, setIdentities] = useState<any[]>([]),
    [query, setQuery] = useState(""),
    [id, setId] = useState(
      new URLSearchParams(location.search).get("cigarId") || "",
    ),
    [versions, setVersions] = useState<any[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [source, setSource] = useState(""),
    [sourceDate, setSourceDate] = useState(""),
    [fields, setFields] = useState<Record<string, string> | null>(null);
  async function request(path: string, options?: RequestInit) {
    const r = await crmFetch(path, options);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Indisponible");
    return d;
  }
  useEffect(() => {
    let alive = true;
    request("/api/admin/backoffice/identities")
      .then((d) => {
        if (alive) setIdentities(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setVersions([]);
    setFields(null);
    setText("");
    setSource("");
    setSourceDate("");
    setMessage("");
    setError("");
    if (id)
      request(`/api/admin/internal/sheets/${encodeURIComponent(id)}`)
        .then((d) => {
          if (alive) setVersions(d);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [id]);
  async function act(save = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (save) {
        await request("/api/admin/internal/sheets", {
          method: "POST",
          body: JSON.stringify({
            cigarId: id,
            source,
            sourceDate: sourceDate || null,
            originalText: text,
            fields,
          }),
        });
        setVersions(
          await request(`/api/admin/internal/sheets/${encodeURIComponent(id)}`),
        );
        setMessage("Version interne enregistrée ; historique conservé.");
        setTab("Consultation");
      } else
        setFields(
          await request("/api/admin/internal/sheets/parse", {
            method: "POST",
            body: JSON.stringify({ text }),
          }),
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-serif">Fiches techniques internes</h1>
      <p>
        Référentiel factuel par identité. Les versions et leur source sont
        conservées.
      </p>
      <div className="flex gap-2">
        {["Association", "Consultation"].map((t) => (
          <button
            className={`border rounded px-4 py-2 ${tab === t ? "bg-primary text-white" : ""}`}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        className="border p-2 w-full"
        aria-label="Rechercher une identité"
        placeholder="Marque, ligne, vitole, format, dimension ou CigarID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        className="border p-2 w-full"
        aria-label="Identité cigare"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">Sélectionner une identité</option>
        {identities
          .filter(
            (r) =>
              r.cigar_id === id ||
              JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
          )
          .map((r) => (
            <option key={r.cigar_id} value={r.cigar_id}>
              {[r.marque, r.ligne, r.vitole, r.format, r.dimensions]
                .filter(Boolean)
                .join(" · ")}{" "}
              — {r.cigar_id}
            </option>
          ))}
      </select>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {id && tab === "Consultation" && (
        <div className="space-y-4">
          {!error && !versions.length && (
            <p>Aucune version interne associée.</p>
          )}
          {versions.map((v, i) => (
            <details
              key={v.versionId}
              open={i === 0}
              className="border rounded p-4"
            >
              <summary>
                {v.legacy
                  ? "Fiche historique structurée"
                  : i === 0
                    ? "Version actuelle"
                    : "Version antérieure"}{" "}
                · {dateLabel(v.createdAt)} · {v.source}
              </summary>
              <p>
                Source : {v.source} · Date source : {dateLabel(v.sourceDate)} ·
                Enregistrée par : {v.createdBy}
              </p>
              <dl className="grid grid-cols-2 gap-2 mt-3">
                {Object.entries(
                  typeof v.fields === "string"
                    ? JSON.parse(v.fields)
                    : v.fields,
                ).map(([k, value]) => (
                  <React.Fragment key={k}>
                    <dt>{labels[k] || k}</dt>
                    <dd>{String(value || "Non documenté")}</dd>
                  </React.Fragment>
                ))}
              </dl>
              <details className="mt-3">
                <summary>
                  {v.legacy ? "Contenu structuré conservé" : "Contenu original"}
                </summary>
                <pre className="whitespace-pre-wrap text-sm">
                  {v.originalText}
                </pre>
              </details>
            </details>
          ))}
        </div>
      )}
      {id && tab === "Association" && (
        <section className="space-y-3">
          <textarea
            aria-label="Contenu original"
            className="border rounded w-full p-3 h-44"
            placeholder="Coller la source factuelle"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFields(null);
            }}
          />
          <button
            disabled={busy || !text.trim()}
            className="border rounded p-2 disabled:opacity-40"
            onClick={() => act()}
          >
            Analyser les champs factuels
          </button>
          {fields && (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                {Object.entries(labels).map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      className="border p-2 w-full"
                      value={fields[k] || ""}
                      onChange={(e) =>
                        setFields({ ...fields, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                Source *
                <input
                  className="border p-2 w-full"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
              <label className="block">
                Date de la source, si connue
                <input
                  type="date"
                  className="border p-2 block"
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                />
              </label>
              <button
                disabled={busy || !source.trim()}
                onClick={() => act(true)}
                className="bg-primary text-white rounded p-2 disabled:opacity-40"
              >
                Sauvegarder la version vérifiée
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
