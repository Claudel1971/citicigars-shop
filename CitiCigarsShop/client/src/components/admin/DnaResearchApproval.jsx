import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/config";
import { Search, Save, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

const FIELD_DEFS = [
  { key: "vitole", label: "Vitole" },
  { key: "dimensions", label: "Dimensions" },
  { key: "sourcingClass", label: "Classe sourcing" },
  { key: "puissance", label: "Puissance" },
  { key: "famille1", label: "Famille 1" },
  { key: "famille2", label: "Famille 2" },
  { key: "famille3", label: "Famille 3" },
  { key: "intensite", label: "Intensité" },
  { key: "spice", label: "Spice" },
  { key: "sweet", label: "Sweetness" },
  { key: "signatures", label: "Signatures" },
  { key: "dureeMin", label: "Durée min." },
  { key: "dureeMax", label: "Durée max." },
  { key: "confidence", label: "Confiance" },
];

const STATUS_LABELS = {
  DRAFT: "À rechercher",
  RESEARCHED: "Proposé",
  REVIEW: "À revoir",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

function adminHeaders(json = false) {
  const token = sessionStorage.getItem("cms_token") || "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "x-cms-token": token,
  };
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function profileFromForm(form) {
  const out = {};
  for (const { key } of FIELD_DEFS) {
    const value = form[key];
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export default function DnaResearchApproval() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [batchResearching, setBatchResearching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [proposed, setProposed] = useState({});
  const [finalValues, setFinalValues] = useState({});
  const [memoResearch, setMemoResearch] = useState("");
  const [memoValidation, setMemoValidation] = useState("");
  const [workingStatus, setWorkingStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [message, setMessage] = useState("");

  const loadRows = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);

      const res = await fetch(
        `${API_URL}/api/admin/dna-research${params.toString() ? `?${params}` : ""}`,
        { headers: adminHeaders() },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      console.error(err);
      setMessage("Impossible de charger le référentiel DNA.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [status]);

  const openCigar = async (cigarId) => {
    setMessage("");
    try {
      const res = await fetch(
        `${API_URL}/api/admin/dna-research/${encodeURIComponent(cigarId)}`,
        { headers: adminHeaders() },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setSelected(data);
      setProposed(data.proposedProfile || {});
      setFinalValues(data.finalProfile || data.proposedProfile || {});
      setMemoResearch(data.memoResearch || "");
      setMemoValidation(data.memoValidation || "");
      setWorkingStatus(data.status || "DRAFT");
    } catch (err) {
      console.error(err);
      setMessage("Impossible d'ouvrir ce cigare.");
    }
  };

  const toggleSelected = (cigarId) => {
    setSelectedIds((prev) =>
      prev.includes(cigarId)
        ? prev.filter((id) => id !== cigarId)
        : [...prev, cigarId],
    );
  };

  const runResearchForId = async (cigarId) => {
    const res = await fetch(
      `${API_URL}/api/admin/dna-research/${encodeURIComponent(cigarId)}/research`,
      {
        method: "POST",
        headers: adminHeaders(true),
      },
    );

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.detail || body.error || `HTTP ${res.status}`);
    }

    return body;
  };

  const researchBatch = async () => {
    if (!selectedIds.length || batchResearching) return;

    const ids = [...selectedIds];
    setBatchResearching(true);
    setBatchProgress({ done: 0, total: ids.length });
    setMessage("");

    const successful = [];
    const failed = [];

    let cursor = 0;

    const worker = async () => {
      while (cursor < ids.length) {
        const cigarId = ids[cursor++];
        try {
          await runResearchForId(cigarId);
          successful.push(cigarId);
        } catch (err) {
          console.error("DNA batch research failed", cigarId, err);
          failed.push(cigarId);
        } finally {
          setBatchProgress((prev) => ({
            ...prev,
            done: prev.done + 1,
          }));
        }
      }
    };

    try {
      const concurrency = Math.min(3, ids.length);
      await Promise.all(
        Array.from({ length: concurrency }, () => worker()),
      );

      await loadRows();

      if (successful.length) {
        setReviewQueue(successful);
        setReviewIndex(0);
        setSelectedIds([]);
        await openCigar(successful[0]);

        setMessage(
          failed.length
            ? `${successful.length} recherche(s) terminée(s), ${failed.length} échec(s).`
            : `${successful.length} recherche(s) terminée(s).`,
        );
      } else {
        setMessage("Aucune recherche du lot n'a abouti.");
      }
    } finally {
      setBatchResearching(false);
    }
  };

  const navigateReview = async (nextIndex) => {
    if (
      nextIndex < 0 ||
      nextIndex >= reviewQueue.length ||
      nextIndex === reviewIndex
    ) return;

    setReviewIndex(nextIndex);
    await openCigar(reviewQueue[nextIndex]);
  };

  const research = async () => {
    if (!selected || researching) return;

    setResearching(true);
    setMessage("");

    try {
      const res = await fetch(
        `${API_URL}/api/admin/dna-research/${encodeURIComponent(selected.cigarId)}/research`,
        {
          method: "POST",
          headers: adminHeaders(true),
        },
      );

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (body.error === "openai_api_key_missing") {
          throw new Error("Clé OpenAI absente du serveur staging.");
        }
        if (body.error === "research_already_completed") {
          throw new Error("Une proposition de recherche existe déjà pour ce cigare.");
        }
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }

      setProposed(body.proposedProfile || {});
      setFinalValues(body.finalProfile || body.proposedProfile || {});
      setMemoResearch(body.memoResearch || "");
      setWorkingStatus(body.status || "RESEARCHED");
      setSelected((prev) =>
        prev ? { ...prev, status: body.status || "RESEARCHED" } : prev,
      );

      setMessage(
        "Recherche terminée. Les valeurs finales ont été initialisées avec la proposition de l’agent.",
      );

      await loadRows();
    } catch (err) {
      console.error(err);
      setMessage(
        err instanceof Error
          ? `Erreur de recherche : ${err.message}`
          : "Erreur lors de la recherche DNA.",
      );
    } finally {
      setResearching(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(
        `${API_URL}/api/admin/dna-research/${encodeURIComponent(selected.cigarId)}`,
        {
          method: "PUT",
          headers: adminHeaders(true),
          body: JSON.stringify({
            finalProfile: profileFromForm(finalValues),
            memoValidation,
          }),
        },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setMessage("Valeurs finales enregistrées.");
      await openCigar(selected.cigarId);
      await loadRows();
    } catch (err) {
      console.error(err);
      setMessage("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(
        `${API_URL}/api/admin/dna-research/${encodeURIComponent(selected.cigarId)}/approve`,
        {
          method: "POST",
          headers: adminHeaders(true),
          body: JSON.stringify({
            finalProfile: profileFromForm(finalValues),
            memoValidation,
            approvedBy: "Claudel",
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setWorkingStatus("APPROVED");
      setMessage("Profil DNA approuvé.");
      await openCigar(selected.cigarId);
      await loadRows();
    } catch (err) {
      console.error(err);
      setMessage("Erreur lors de l'approbation.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCount = useMemo(() => rows.length, [rows]);

  if (selected) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            onClick={() => {
              setSelected(null);
              setMessage("");
              setReviewQueue([]);
              setReviewIndex(0);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            <ChevronLeft size={18} />
            Retour à la liste
          </button>

          {reviewQueue.length > 0 && (
            <div className="flex items-center gap-3 text-sm font-semibold">
              <button
                onClick={() => navigateReview(reviewIndex - 1)}
                disabled={reviewIndex === 0 || saving || researching}
                className="p-2 border rounded-md disabled:opacity-30"
                aria-label="Cigare précédent"
              >
                <ChevronLeft size={18} />
              </button>

              <span>
                Cigare {reviewIndex + 1} sur {reviewQueue.length}
              </span>

              <button
                onClick={() => navigateReview(reviewIndex + 1)}
                disabled={
                  reviewIndex >= reviewQueue.length - 1 ||
                  saving ||
                  researching
                }
                className="p-2 border rounded-md disabled:opacity-30"
                aria-label="Cigare suivant"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-5 md:p-7 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{selected.cigarId}</div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">
                {selected.marque} — {selected.ligne}
              </h1>
              <div className="mt-1 text-muted-foreground">
                {selected.vitole}
                {selected.dimensions ? ` • ${selected.dimensions}` : ""}
                {selected.format ? ` • ${selected.format}` : ""}
              </div>
            </div>

            <div className="shrink-0">
              <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-muted">
                {researching ? "Recherche en cours…" : (STATUS_LABELS[workingStatus] || workingStatus)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b">
            <h2 className="text-xl font-bold">Profil DNA — 14 champs</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Proposition de recherche à gauche. Valeur retenue à droite.
            </p>
          </div>

          <div className="divide-y">
            {FIELD_DEFS.map(({ key, label }) => (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr] gap-3 md:gap-5 p-4 md:p-5"
              >
                <div className="font-semibold text-sm md:pt-2">{label}</div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Proposition
                  </label>
                  <input
                    value={normalizeValue(proposed[key])}
                    readOnly
                    className="w-full border rounded-md px-3 py-2 bg-amber-50/40 text-muted-foreground cursor-default"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Valeur finale
                  </label>
                  <input
                    value={normalizeValue(finalValues[key])}
                    onChange={(e) =>
                      setFinalValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="w-full border rounded-md px-3 py-2 bg-emerald-50/30"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-bold mb-2">Mémo recherche / sources</h3>
            <textarea
              value={memoResearch}
              readOnly
              rows={7}
              placeholder="La recherche agent et ses sources apparaîtront ici..."
              className="w-full border rounded-md p-3 resize-y bg-muted/20 text-muted-foreground cursor-default"
            />
          </div>

          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-bold mb-2">Mémo validation / arbitrage</h3>
            <textarea
              value={memoValidation}
              onChange={(e) => setMemoValidation(e.target.value)}
              rows={7}
              placeholder="Décision finale, corrections apportées et raison de l'arbitrage..."
              className="w-full border rounded-md p-3 resize-y"
            />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={research}
              disabled={
                researching ||
                saving ||
                workingStatus === "RESEARCHED" ||
                workingStatus === "APPROVED"
              }
              className="inline-flex justify-center items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
            >
              <Search size={18} />
              {researching
                ? "Recherche en cours…"
                : workingStatus === "RESEARCHED" || workingStatus === "APPROVED"
                  ? "Recherche effectuée"
                  : "Lancer la recherche DNA"}
            </button>

            <button
              onClick={save}
              disabled={saving}
              className="inline-flex justify-center items-center gap-2 px-4 py-2 rounded-md border font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Save size={18} />
              Enregistrer
            </button>
          </div>

          <button
            onClick={approve}
            disabled={saving || researching || workingStatus !== "RESEARCHED"}
            className="inline-flex justify-center items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground font-bold disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            Approuver le profil DNA
          </button>
        </div>

        {message && (
          <div className="text-sm font-medium bg-muted rounded-md px-4 py-3">
            {message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary">
          DNA Research & Approval
        </h1>
        <p className="text-muted-foreground mt-1">
          Recherche, revue et approbation humaine des profils DNA.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadRows();
              }}
              placeholder="CIGAR_ID, marque, ligne ou vitole..."
              className="w-full border rounded-md pl-10 pr-3 py-2"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">Tous les statuts</option>
            <option value="DRAFT">À rechercher</option>
            <option value="RESEARCHED">Proposé</option>
            <option value="REVIEW">À revoir</option>
            <option value="APPROVED">Approuvé</option>
            <option value="REJECTED">Rejeté</option>
          </select>

          <button
            onClick={researchBatch}
            disabled={!selectedIds.length || batchResearching}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-40"
          >
            {batchResearching
              ? `Recherche ${batchProgress.done}/${batchProgress.total}`
              : selectedIds.length
                ? `Rechercher (${selectedIds.length})`
                : "Rechercher"}
          </button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {loading ? "Chargement..." : `${filteredCount} cigare(s)`}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {rows.map((row) => (
          <div
            key={row.cigarId}
            onClick={() => openCigar(row.cigarId)}
            role="button"
            tabIndex={0}
            className="text-left bg-white border rounded-xl p-4 md:p-5 shadow-sm hover:border-primary/40 hover:shadow transition cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">{row.cigarId}</div>
                <div className="font-bold text-lg">
                  {row.marque} — {row.ligne}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {row.vitole}
                  {row.dimensions ? ` • ${row.dimensions}` : ""}
                </div>
              </div>

              <div className="self-start flex items-center gap-3">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-muted">
                  {STATUS_LABELS[row.status] || row.status}
                </span>

                {row.status === "DRAFT" && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.cigarId)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelected(row.cigarId)}
                    className="h-5 w-5 cursor-pointer"
                    aria-label={`Sélectionner ${row.cigarId}`}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <div className="text-sm font-medium bg-muted rounded-md px-4 py-3">
          {message}
        </div>
      )}
    </div>
  );
}
