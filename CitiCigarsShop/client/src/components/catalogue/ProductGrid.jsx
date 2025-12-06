import React, { useState, useMemo } from "react";
import { useProducts } from "@/context/ProductContext";
import ProductCard from "./ProductCard";
import ProductDetail from "./ProductDetail";
import SearchBar from "./SearchBar";
import AlphabetNav from "./AlphabetNav";
import { Loader2 } from "lucide-react";

const ProductGrid = () => {
  const { products } = useProducts();

  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState("Tous");
  const [selectedPuissance, setSelectedPuissance] = useState(0); // 0 = toutes puissances
  const [selectedBudget, setSelectedBudget] = useState("Tous");
  const [selectedRing, setSelectedRing] = useState("Tous");
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ---------- Helpers -----------

  const getPuissanceLabel = (niveau) => {
    const map = {
      1: "Léger (Mild)",
      2: "Léger-Moyen (Mild-Medium)",
      3: "Moyen (Medium)",
      4: "Medium-Full",
      5: "Corsé (Full-bodied)",
    };
    return map[niveau] || "";
  };

  const getBudgetCategory = (price) => {
    if (price == null || isNaN(price)) return null;
    const p = Number(price);
    if (p < 10000) return "<10000";
    if (p <= 14950) return "10000-14950";
    if (p <= 17950) return "15000-17950";
    if (p <= 20000) return "18000-20000";
    return ">20000";
  };

  const extractRingGauge = (product) => {
    // PRIORITÉ 1 : Champ ringGauge direct (colonne Ring de l'Excel)
    if (product.ringGauge && !isNaN(product.ringGauge)) {
      return parseInt(product.ringGauge);
    }
    
    // PRIORITÉ 2 : Extraire du champ format (pouces, ex: "5 × 50") - le 2ème nombre
    if (product.format && product.format.includes('×')) {
      const match = product.format.match(/(\d+(?:[.,½¼¾⅛⅜⅝⅞])?)\s*[×xX]\s*(\d+)/);
      if (match) {
        return parseInt(match[2]); // Le 2ème nombre = ring gauge
      }
    }
    
    // PRIORITÉ 3 : Extraire du vitole si contient dimensions (ex: "Robusto (5 × 50)")
    if (product.vitole && product.vitole.includes('×')) {
      const match = product.vitole.match(/(\d+)\s*[×xX]\s*(\d+)/);
      if (match) {
        return parseInt(match[2]);
      }
    }
    
    // NOTE: Ne PAS utiliser product.dimensions car il contient les MM (ex: "152 × 21,4")
    
    return null;
  };

  const getRingCategory = (product) => {
    const gauge = extractRingGauge(product);
    if (gauge == null) return null;

    if (gauge < 50) return "S";
    if (gauge <= 52) return "M";
    if (gauge <= 56) return "L";
    if (gauge <= 60) return "XL";
    return "XXL";
  };

  const resetAllFilters = () => {
    setSearch("");
    setActiveLetter(null);
    setSelectedCountry("Tous");
    setSelectedPuissance(0);
    setSelectedBudget("Tous");
    setSelectedRing("Tous");
  };

  // ---------- Pays (uniquement ceux en catalogue) -----------

  const countries = useMemo(() => {
    const catalogueProducts = products.filter((p) => p.inCatalogue !== false);
    const unique = new Set(
      catalogueProducts.map((p) => p.pays).filter(Boolean),
    );
    return ["Tous", ...Array.from(unique).sort()];
  }, [products]);

  // Nombre total de produits en catalogue (avant filtres)
  const totalCatalogueCount = useMemo(
    () => products.filter((p) => p.inCatalogue !== false).length,
    [products],
  );

  // ---------- Filtrage principal -----------

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1) Visible dans le catalogue
      if (p.inCatalogue === false) return false;

      // 2) Search
      const query = search.toLowerCase();
      const matchesSearch =
        query === "" ||
        p.marque?.toLowerCase().includes(query) ||
        p.modele?.toLowerCase().includes(query) ||
        p.vitole?.toLowerCase().includes(query) ||
        p.origine?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // 3) Lettre
      const matchesLetter =
        activeLetter === null ||
        p.marque?.toUpperCase().startsWith(activeLetter);

      if (!matchesLetter) return false;

      // 4) Pays
      const matchesCountry =
        selectedCountry === "Tous" || p.pays === selectedCountry;

      if (!matchesCountry) return false;

      // 5) Puissance
      const puissance = Number(p.puissance);
      const matchesPuissance =
        selectedPuissance === 0 ||
        (!isNaN(puissance) && puissance === selectedPuissance);

      if (!matchesPuissance) return false;

      // 6) Budget
      const budgetCategory = getBudgetCategory(p.prixUnitaire);
      const matchesBudget =
        selectedBudget === "Tous" ||
        (budgetCategory && budgetCategory === selectedBudget);

      if (!matchesBudget) return false;

      // 7) Grosseur
      const ringCategory = getRingCategory(p);
      const matchesRing =
        selectedRing === "Tous" ||
        (ringCategory && ringCategory === selectedRing);

      if (!matchesRing) return false;

      return true;
    });
  }, [
    products,
    search,
    activeLetter,
    selectedCountry,
    selectedPuissance,
    selectedBudget,
    selectedRing,
  ]);

  // Tri marque A→Z
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) =>
      (a.marque || "").localeCompare(b.marque || ""),
    );
  }, [filteredProducts]);

  // ---------- UI -----------

  return (
    <div className="space-y-8 pb-20">
      {/* Bandeau haut + search + filtres */}
      <div className="bg-muted/30 py-8 px-4">
        <div className="container mx-auto space-y-6">
          {/* Titre + search (search à droite en desktop) */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-3 md:max-w-xl text-left">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary">
                Le Catalogue
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Explorez notre cave d&apos;exception. Des grands classiques
                cubains aux pépites du Nouveau Monde.
              </p>
            </div>

            <div className="w-full md:w-80 md:self-start">
              <SearchBar
                value={search}
                onChange={setSearch}
                resultCount={sortedProducts.length}
              />
            </div>
          </div>

          {/* Encadré des filtres (dropdowns) */}
          <div className="mt-4 bg-white/80 border rounded-xl shadow-sm p-4 md:p-5 text-left">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filtres
              </h3>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-medium text-primary hover:underline"
              >
                Réinitialiser tous les filtres
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Pays */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Par pays
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country === "Tous" ? "Tous les pays" : country}
                    </option>
                  ))}
                </select>
              </div>

              {/* Puissance */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Filtrez selon la puissance
                </label>
                <select
                  value={selectedPuissance}
                  onChange={(e) => setSelectedPuissance(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value={0}>Toutes puissances</option>
                  {[1, 2, 3, 4, 5].map((niveau) => (
                    <option key={niveau} value={niveau}>
                      {getPuissanceLabel(niveau)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Par budget (prix unitaire)
                </label>
                <select
                  value={selectedBudget}
                  onChange={(e) => setSelectedBudget(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value="Tous">Tous les budgets</option>
                  <option value="<10000">&lt; 10 000 FCFA</option>
                  <option value="10000-14950">10 000 – 14 950 FCFA</option>
                  <option value="15000-17950">15 000 – 17 950 FCFA</option>
                  <option value="18000-20000">18 000 – 20 000 FCFA</option>
                  <option value=">20000">&gt; 20 000 FCFA</option>
                </select>
              </div>

              {/* Grosseur */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Par grosseur (ring gauge)
                </label>
                <select
                  value={selectedRing}
                  onChange={(e) => setSelectedRing(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value="Tous">Toutes tailles</option>
                  <option value="S">S (&lt; 50)</option>
                  <option value="M">M (50 – 52)</option>
                  <option value="L">L (54 – 56)</option>
                  <option value="XL">XL (57 – 60)</option>
                  <option value="XXL">XXL (&gt; 60)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compteur de résultats */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between text-xs md:text-sm text-muted-foreground mt-2">
          <span>
            {sortedProducts.length} résultat
            {sortedProducts.length > 1 ? "s" : ""} affiché
            {sortedProducts.length > 1 ? "s" : ""}
          </span>
          <span className="hidden sm:inline">
            sur {totalCatalogueCount} cigare
            {totalCatalogueCount > 1 ? "s" : ""} au catalogue
          </span>
        </div>
      </div>

      {/* Navigation alphabétique */}
      <AlphabetNav
        activeLetter={activeLetter}
        onSelectLetter={setActiveLetter}
      />

      {/* Grille produits */}
      <div className="container mx-auto px-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p>Chargement de la cave...</p>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-border">
            <h3 className="text-xl font-serif text-muted-foreground">
              Aucun cigare trouvé
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Essayez de modifier vos critères de recherche ou réinitialisez les
              filtres.
            </p>
            <button
              onClick={resetAllFilters}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Réinitialiser tous les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.sku}
                product={product}
                onOpenDetails={setSelectedProduct}
              />
            ))}
          </div>
        )}
      </div>

      <ProductDetail
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};

export default ProductGrid;
