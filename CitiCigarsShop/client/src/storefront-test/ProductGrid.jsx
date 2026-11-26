import React from "react";
import { Search } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { useWishlist } from "@/context/WishlistContext";
import { filterChoices, filterProducts } from "./catalogue";
import ProductCard from "./ProductCard";
import { confirmed, useCatalogue } from "./resources";

export function LoadState({ resource, children }) {
  return (
    <div className="empty-state" role={resource.isFetching ? "status" : "alert"}>
      {resource.isFetching ? "Vérification des prix et disponibilités…" : (
        <>
          <h2>Vérification indisponible</h2>
          <p>{children || "Les prix et disponibilités ne peuvent pas être vérifiés pour le moment."}</p>
          <button type="button" className="button button-outline" onClick={() => resource.refetch()}>Réessayer</button>
        </>
      )}
    </div>
  );
}

export default function ProductGrid({ favoritesOnly = false }) {
  const resource = useCatalogue();
  const products = confirmed(resource);
  const { wishlist } = useWishlist();
  const [, navigate] = useLocation();
  const query = useSearch();
  const params = new URLSearchParams(query);
  const filtered = products && (favoritesOnly
    ? wishlist.flatMap((favorite) => products.find((product) => product.sku === favorite.sku) || [])
    : filterProducts(products, params));
  const setFilter = (name, value) => {
    if (value) params.set(name, value);
    else params.delete(name);
    navigate(params.size ? `/catalogue?${params}` : "/catalogue", { replace: true });
  };
  return (
    <section className="shell catalogue-page">
      <div className="page-heading">
        <p className="eyebrow">Cigares et assortiments</p>
        <h1>{favoritesOnly ? "Mes favoris" : "Le catalogue"}</h1>
      </div>
      {products && !favoritesOnly && (
        <div className="catalogue-controls">
          <div className="catalogue-search-row">
            <label className="search-field">
              <span className="sr-only">Rechercher</span><Search aria-hidden="true" />
              <input type="search" value={params.get("q") || ""} placeholder="Rechercher un cigare"
                onChange={(event) => setFilter("q", event.target.value)} />
            </label>
            <button className="filter" aria-pressed={params.get("filtre") === "assortiments"}
              onClick={() => setFilter("filtre", params.has("filtre") ? "" : "assortiments")}>Assortiments</button>
          </div>
          <details className="catalogue-filters">
            <summary>Filtres</summary>
            <div className="filter-grid">
              {filterChoices(products).map(([id, label, options]) => (
                <label key={id}>{label}
                  <select name={id} value={params.get(id) || ""} onChange={(event) => setFilter(id, event.target.value)}>
                    <option value="">Tous</option>
                    {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </details>
          <div className="catalogue-results-row">
            <p className="results-count" aria-live="polite">{filtered.length} référence{filtered.length === 1 ? "" : "s"}</p>
            <button className="text-link" onClick={() => navigate("/catalogue", { replace: true })}>Tout réinitialiser</button>
          </div>
        </div>
      )}
      {!products ? <LoadState resource={resource} /> : filtered.length > 0
        ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.sku} product={product}
            returnQuery={favoritesOnly ? "" : query} />)}</div>
        : <div className="empty-state">
            <h2>{favoritesOnly ? "Aucun favori disponible" : "Aucun résultat"}</h2>
            <Link className="text-link" href="/catalogue">Tout le catalogue</Link>
          </div>}
    </section>
  );
}
