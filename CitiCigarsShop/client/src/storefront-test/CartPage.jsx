import React, { useRef } from "react";
import { Link } from "wouter";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/priceCalculator";
import { productPath, purchaseOptions, stockLabel } from "./catalogue";
import { LoadState } from "./ProductGrid";
import { Photo } from "./ProductCard";
import { confirmed, useCatalogue } from "./resources";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity } = useCart();
  const resource = useCatalogue();
  const catalogue = confirmed(resource);
  const incrementing = useRef(false);
  const productsBySku = new Map(catalogue?.map((product) => [product.sku, product]));
  const lines = items.map((item) => {
    const product = productsBySku.get(item.sku);
    const option = product && purchaseOptions(product).find(({ id }) => id === item.format);
    return { item, option, product };
  });
  const allConfirmed = catalogue && lines.every(({ option }) => option);
  const total = allConfirmed ? lines.reduce((sum, { item, option }) => sum + item.quantite * option.price, 0) : null;

  const increment = async (item) => {
    if (incrementing.current) return;
    incrementing.current = true;
    try {
      const latest = await resource.refetch();
      const product = latest.isSuccess && latest.data.find((p) => p.sku === item.sku);
      if (product && purchaseOptions(product).some((option) => option.id === item.format)) {
        updateQuantity(item.id, 1);
      }
    } finally {
      incrementing.current = false;
    }
  };

  return (
    <section className="shell cart-page">
      <Link className="back-link" href="/catalogue">Continuer mes achats</Link>
      <div className="page-heading">
        <p className="eyebrow">Votre sélection</p>
        <h1>Panier</h1>
      </div>
      {!items.length ? <div className="empty-state"><h2>Votre panier est vide</h2></div> : (
        <>
          {!catalogue && <LoadState resource={resource}>Les articles sont conservés. Les prix et disponibilités restent à vérifier.</LoadState>}
          <div className="cart-layout">
            <div className="cart-items">
              {lines.map(({ item, option, product }) => (
                <article key={item.id} className="cart-item" data-cart-line={item.id}>
                  <Link className="cart-photo" href={productPath(item.sku)} tabIndex={-1} aria-hidden="true">
                    <Photo src={option?.image || item.image} alt="" />
                  </Link>
                  <div className="cart-item-info">
                    <h2><Link href={productPath(item.sku)}>{[item.marque, item.modele || item.ligne].filter(Boolean).join(" ")}</Link></h2>
                    <p className="cart-format">{item.sku} · {option?.label || ({ pack: "Pack", boite: "Boîte", bundle: "Assortiment", unitaire: "Unité" }[item.format] ?? item.format)}
                      {option?.pieces > 0 && ` · ${option.pieces} cigares`}</p>
                    <div className="line-actions">
                      <div className="quantity">
                        <button type="button" disabled={item.quantite <= 1} onClick={() => updateQuantity(item.id, -1)} aria-label="Réduire la quantité">−</button>
                        <output aria-label="Quantité">{item.quantite}</output>
                        <button type="button" disabled={!option} onClick={() => increment(item)} aria-label="Augmenter la quantité">+</button>
                      </div>
                      <button type="button" className="remove" onClick={() => removeFromCart(item.id)}>Retirer</button>
                    </div>
                  </div>
                  <strong className="line-price">{option ? formatPrice(item.quantite * option.price)
                    : catalogue ? stockLabel(product) || "Conditionnement indisponible" : "Prix et disponibilité à vérifier"}</strong>
                </article>
              ))}
            </div>
            <aside className="cart-summary">
              <h2>Récapitulatif</h2>
              {total !== null ? <p className="summary-total"><span>Sous-total</span><strong>{formatPrice(total)}</strong></p>
                : <p className="fine-print">Sous-total à confirmer</p>}
              {total !== null && <Link className="button button-primary" href="/checkout">Préparer la commande</Link>}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
