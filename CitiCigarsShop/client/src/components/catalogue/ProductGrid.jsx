import React, { useState, useMemo, useEffect } from "react";
import { useProducts } from "@/context/ProductContext";
import ProductCard from "./ProductCard";
import ProductDetail from "./ProductDetail";
import SearchBar from "./SearchBar";
import AlphabetNav from "./AlphabetNav";
import { Loader2 } from "lucide-react";
import i18n from "@/i18n";

const ProductGrid = () => {
  const { products } = useProducts();
  const [, setLang] = useState(i18n.language);

  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);

  const t = (key, options) => i18n.t(key, options);

  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState("Tous");
  const [selectedFormat, setSelectedFormat] = useState("Tous");
  const [selectedPuissance, setSelectedPuissance] = useState(0);
  const [selectedBudget, setSelectedBudget] = useState("Tous");
  const [selectedRing, setSelectedRing] = useState("Tous");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const getPuissanceLabel = (niveau) => {
    return t(`catalogue.strengthLabels.${niveau}`) || "";
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
    setSelectedFormat("Tous");
    setSelectedPuissance(0);
    setSelectedBudget("Tous");
    setSelectedRing("Tous");
  };

  // ---------- Pays (uniquement ceux en catalogue) -----------

  const countryFlagCodes = {
    "Cuba": "cu",
    "Nicaragua": "ni",
    "République Dominicaine": "do",
    "Dominican Republic": "do",
    "Honduras": "hn",
    "Mexique": "mx",
    "Mexico": "mx",
    "Brésil": "br",
    "Brazil": "br",
    "Costa Rica": "cr",
    "Équateur": "ec",
    "Ecuador": "ec",
    "Jamaïque": "jm",
    "Jamaica": "jm",
    "États-Unis": "us",
    "USA": "us",
    "Cameroun": "cm",
    "Cameroon": "cm",
    "Indonésie": "id",
    "Indonesia": "id",
    "Philippines": "ph",
  };

  const getFlagImageUrl = (country) => {
    if (country === "Tous") return null;
    const code = countryFlagCodes[country];
    if (code) {
      return `https://flagcdn.com/w40/${code}.png`;
    }
    return null;
  };

  const countries = useMemo(() => {
    const catalogueProducts = products.filter((p) => p.inCatalogue !== false);
    const unique = new Set(
      catalogueProducts.map((p) => p.pays).filter(Boolean),
    );
    return ["Tous", ...Array.from(unique).sort()];
  }, [products]);

  // ---------- Formats (vitoles) disponibles -----------
  const extractBaseFormat = (vitole) => {
    if (!vitole) return null;
    const base = vitole.split(/[\s(]/)[0].trim();
    return base || null;
  };

  const getProductFormat = (product) => {
    // Priorité 1: champ vitole (ex: "Robusto", "Toro Grande")
    const fromVitole = extractBaseFormat(product.vitole);
    if (fromVitole) return fromVitole;
    // Priorité 2: champ format si pas de vitole
    if (product.format) {
      const base = product.format.split(/[\s(]/)[0].trim();
      return base || null;
    }
    return null;
  };

  const formats = useMemo(() => {
    const catalogueProducts = products.filter((p) => p.inCatalogue !== false);
    const unique = new Set(
      catalogueProducts.map((p) => getProductFormat(p)).filter(Boolean),
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

      // 5) Format (vitole ou format)
      const productFormat = getProductFormat(p);
      const matchesFormat =
        selectedFormat === "Tous" || productFormat === selectedFormat;

      if (!matchesFormat) return false;

      // 6) Puissance
      const puissance = Number(p.puissance);
      const matchesPuissance =
        selectedPuissance === 0 ||
        (!isNaN(puissance) && puissance === selectedPuissance);

      if (!matchesPuissance) return false;

      // 7) Budget
      const budgetCategory = getBudgetCategory(p.prixUnitaire);
      const matchesBudget =
        selectedBudget === "Tous" ||
        (budgetCategory && budgetCategory === selectedBudget);

      if (!matchesBudget) return false;

      // 8) Grosseur
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
    selectedFormat,
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

  // ---------- Lettres disponibles (basées sur les filtres SAUF la lettre) -----------
  const availableLetters = useMemo(() => {
    const letters = new Set();
    products
      .filter((p) => {
        // Même logique que filteredProducts, SANS le filtre de lettre
        if (p.inCatalogue === false) return false;

        const query = search.toLowerCase();
        const matchesSearch =
          query === "" ||
          p.marque?.toLowerCase().includes(query) ||
          p.modele?.toLowerCase().includes(query) ||
          p.vitole?.toLowerCase().includes(query) ||
          p.origine?.toLowerCase().includes(query);
        if (!matchesSearch) return false;

        const matchesCountry =
          selectedCountry === "Tous" || p.pays === selectedCountry;
        if (!matchesCountry) return false;

        const productFormat = getProductFormat(p);
        const matchesFormat =
          selectedFormat === "Tous" || productFormat === selectedFormat;
        if (!matchesFormat) return false;

        const puissance = Number(p.puissance);
        const matchesPuissance =
          selectedPuissance === 0 ||
          (!isNaN(puissance) && puissance === selectedPuissance);
        if (!matchesPuissance) return false;

        const budgetCategory = getBudgetCategory(p.prixUnitaire);
        const matchesBudget =
          selectedBudget === "Tous" ||
          (budgetCategory && budgetCategory === selectedBudget);
        if (!matchesBudget) return false;

        const ringCategory = getRingCategory(p);
        const matchesRing =
          selectedRing === "Tous" ||
          (ringCategory && ringCategory === selectedRing);
        if (!matchesRing) return false;

        return true;
      })
      .forEach((p) => {
        const firstChar = p.marque?.charAt(0).toUpperCase();
        if (firstChar) letters.add(firstChar);
      });
    return letters;
  }, [products, search, selectedCountry, selectedFormat, selectedPuissance, selectedBudget, selectedRing]);

  // Reset activeLetter if it's no longer available after filter changes
  useEffect(() => {
    if (activeLetter && !availableLetters.has(activeLetter)) {
      setActiveLetter(null);
    }
  }, [activeLetter, availableLetters]);

  // ---------- UI -----------

  return (
    <div className="space-y-8 pb-20">
      {/* Bandeau haut + search + filtres */}
      <div className="bg-muted/30 py-8 px-4">
        <div className="container mx-auto space-y-6">
          {/* Titre + search (search à droite en desktop) */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-3 text-left flex-1">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary">
                {t('catalogue.title')}
              </h1>
              <p className="text-muted-foreground whitespace-nowrap">
                {t('catalogue.subtitle')}
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
                {t('catalogue.filters')}
              </h3>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('catalogue.resetFilters')}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Format (vitole) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t('catalogue.filterByFormat')}
                </label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  {formats.map((format) => (
                    <option key={format} value={format}>
                      {format === "Tous" ? t('catalogue.allFormats') : format}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grosseur */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t('catalogue.filterBySize')}
                </label>
                <select
                  value={selectedRing}
                  onChange={(e) => setSelectedRing(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value="Tous">{t('catalogue.allSizes')}</option>
                  <option value="S">{t('catalogue.sizeLabels.S')}</option>
                  <option value="M">{t('catalogue.sizeLabels.M')}</option>
                  <option value="L">{t('catalogue.sizeLabels.L')}</option>
                  <option value="XL">{t('catalogue.sizeLabels.XL')}</option>
                  <option value="XXL">{t('catalogue.sizeLabels.XXL')}</option>
                </select>
              </div>

              {/* Puissance */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t('catalogue.filterByStrength')}
                </label>
                <select
                  value={selectedPuissance}
                  onChange={(e) => setSelectedPuissance(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value={0}>{t('catalogue.allStrengths')}</option>
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
                  {t('catalogue.filterByBudget')}
                </label>
                <select
                  value={selectedBudget}
                  onChange={(e) => setSelectedBudget(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value="Tous">{t('catalogue.allBudgets')}</option>
                  <option value="<10000">{t('catalogue.budgetRanges.under10000')}</option>
                  <option value="10000-14950">{t('catalogue.budgetRanges.10000to14950')}</option>
                  <option value="15000-17950">{t('catalogue.budgetRanges.15000to17950')}</option>
                  <option value="18000-20000">{t('catalogue.budgetRanges.18000to20000')}</option>
                  <option value=">20000">{t('catalogue.budgetRanges.over20000')}</option>
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
            {sortedProducts.length > 1 
              ? t('catalogue.resultsShown_plural', { count: sortedProducts.length })
              : t('catalogue.resultsShown', { count: sortedProducts.length })}
          </span>
          <span className="hidden sm:inline">
            {t('catalogue.outOf', { total: totalCatalogueCount })}
          </span>
        </div>
      </div>

      {/* Drapeaux cliquables pour filtrer par pays */}
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-2 py-2">
          {countries.map((country) => {
            const flagUrl = getFlagImageUrl(country);
            const isSelected = selectedCountry === country;
            const translatedName = country === "Tous" 
              ? t('catalogue.allCountries') 
              : t(`countries.${country}`, { defaultValue: country });
            
            return (
              <button
                key={country}
                onClick={() => setSelectedCountry(country)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                  transition-all duration-200 border
                  ${isSelected 
                    ? 'bg-primary text-white border-primary shadow-md' 
                    : 'bg-white/80 text-muted-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                  }
                `}
                title={translatedName}
              >
                {flagUrl && <img src={flagUrl} alt={translatedName} className="w-6 h-4 object-cover rounded-sm" />}
                <span className={country === "Tous" ? "" : "hidden sm:inline"}>{translatedName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation alphabétique */}
      <AlphabetNav
        activeLetter={activeLetter}
        onSelectLetter={setActiveLetter}
        availableLetters={availableLetters}
      />

      {/* Grille produits */}
      <div className="container mx-auto px-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p>{t('catalogue.loading')}</p>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-border">
            <h3 className="text-xl font-serif text-muted-foreground">
              {t('catalogue.noResults')}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t('catalogue.noResultsHint')}
            </p>
            <button
              onClick={resetAllFilters}
              className="mt-4 text-primary font-bold hover:underline"
            >
              {t('catalogue.resetFilters')}
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
