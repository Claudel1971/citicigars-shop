import React, { useState } from "react";

export function parseSheet(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

export function Facts({ entries }) {
  return <dl>{entries.filter(([, value]) => value).map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export default function TastingSheet({ sheet, member }) {
  const [active, setActive] = useState(0);
  const groups = [
    { label: "Combustion", public: [["Durée", sheet?.duree || sheet?.combustion?.duree], ["Type de fumée", sheet?.combustion?.fumee]],
      title: "Analyse experte", private: [["Tirage", sheet?.combustion?.tirage], ["Combustion", sheet?.combustion?.combustion], ["Cendre", sheet?.combustion?.cendre]] },
    { label: "Arômes", public: [["Notes dominantes", sheet?.aromes?.dominantes]],
      title: "Palette aromatique complète", private: [["Nuances secondaires", sheet?.aromes?.secondaires], ["Évolution", sheet?.aromes?.evolution]] },
    { label: "Dégustation", public: [["Positionnement", sheet?.positionnement || sheet?.degustation?.positionnement]],
      title: "Impressions de dégustation complètes", private: [["Notes de dégustation", sheet?.impressions || sheet?.degustation?.impressions],
        ["Accords suggérés", sheet?.accords || sheet?.degustation?.accords]] },
  ];
  const selectTab = (event) => {
    const next = {
      ArrowLeft: (active + groups.length - 1) % groups.length,
      ArrowRight: (active + 1) % groups.length,
      Home: 0,
      End: groups.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    event.currentTarget.children[next].focus();
  };
  return (
    <section className="product-sheet" aria-labelledby="sheet-heading">
      <h2 id="sheet-heading">Fiche de dégustation</h2>
      {!sheet ? <p className="fine-print">Fiche technique non disponible.</p> : <>
        <div className="sheet-tabs" role="tablist" aria-label="Rubriques de dégustation" onKeyDown={selectTab}>
          {groups.map((group, index) => (
            <button key={group.label} id={`sheet-tab-${index}`} type="button" role="tab" aria-controls={`sheet-panel-${index}`}
              tabIndex={active === index ? 0 : -1} aria-selected={active === index} onClick={() => setActive(index)}>{group.label}</button>
          ))}
        </div>
        {groups.map((group, index) => (
          <div key={group.label} className="sheet-panel" id={`sheet-panel-${index}`} role="tabpanel"
            aria-labelledby={`sheet-tab-${index}`} tabIndex={0} hidden={active !== index}>
            <Facts entries={member ? [...group.public, ...group.private] : group.public} />
            {!member && <p className="member-note">{group.title} · Réservé aux membres</p>}
          </div>
        ))}
      </>}
    </section>
  );
}
