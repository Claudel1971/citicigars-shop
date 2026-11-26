import React from "react";
import { Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useWishlist } from "@/context/WishlistContext";
import { formatPrice } from "@/utils/priceCalculator";
import { isBundle, productName, productPath, productPhotos, purchaseOptions, stockLabel, strengths } from "./catalogue";

export function productLink(sku, returnQuery, section) {
  const query = new URLSearchParams();
  if (returnQuery) query.set("retour", returnQuery);
  if (section) query.set("section", section);
  return productPath(sku) + (query.size ? `?${query}` : "");
}

export function Photo({ src, alt }) {
  return src ? <img src={src} alt={alt} loading="lazy" /> : <p className="missing-photo">Photo à confirmer.</p>;
}

export function Distinctions({ product }) {
  const rating = product.badges?.rating ?? product.rating;
  const rank = product.badges?.top25Rang ?? product.rank;
  const year = product.badges?.top25Year ?? product.year;
  const ranked = product.badges?.top25 ?? product.top25;
  if (!rating && !ranked) return null;
  return (
    <div className="distinctions">
      {ranked && <span className="ranking">{Number(rank) === 1
        ? ["Cigare de l’année", year].filter(Boolean).join(", ")
        : ["Top 25", year].filter(Boolean).join(" ")}</span>}
      {Number(rating) > 0 && <span className="rating" aria-label={`Note ${rating} sur 100`}>{rating}</span>}
    </div>
  );
}

export function Strength({ value, showLabel = false }) {
  const level = Number(value);
  const label = strengths[level - 1];
  if (!label) return null;
  return (
    <span className="strength-meter" role="img" aria-label={`Puissance ${level} sur 5, ${label}`}>
      {showLabel && <span aria-hidden="true">Puissance</span>}
      <span className="strength-marks" aria-hidden="true">
        {strengths.map((name, index) => <span key={name} className={`strength-mark${index < level ? " is-filled" : ""}`} />)}
      </span>
    </span>
  );
}

export function Favorite({ product }) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const active = isInWishlist(product.sku);
  return (
    <button type="button" className="product-action product-favorite" aria-pressed={active}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={() => toggleWishlist({ sku: product.sku, marque: product.marque, modele: product.modele, ligne: product.ligne })}>
      <Heart aria-hidden="true" />
    </button>
  );
}

export function ProductActions({ product, detail = false }) {
  const shareUrl = `https://citicigars.com${productPath(product.sku)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Lien public copié");
    } catch {
      window.prompt("Lien public de la fiche", shareUrl);
    }
  };
  return (
    <div className={`product-actions ${detail ? "detail-utilities" : "card-utilities"}`}>
      <button type="button" className="product-action" data-share-sku={product.sku} aria-label="Copier le lien public" onClick={copy}>
        <Share2 aria-hidden="true" />{detail && "Partager"}
      </button>
      <Favorite product={product} />
    </div>
  );
}

export default function ProductCard({ product, returnQuery }) {
  const bundle = isBundle(product);
  const options = purchaseOptions(product);
  const amount = bundle ? options[0]?.price : Math.min(...options.map((option) => option.price / option.pieces));
  const hasPrice = Number.isFinite(amount);
  const url = productLink(product.sku, returnQuery);
  const name = productName(product);
  const dimensions = String(product.dimensions ?? "").replace(/\s+[×x]\s+/i, "″ × ");
  const specs = [product.vitole !== product.format && product.vitole, product.format, dimensions].filter(Boolean);
  return (
    <article className="product-card" data-product-sku={product.sku}>
      <div className="card-photo">
        <Link href={url} className="card-photo-link" aria-label={`Voir la fiche de ${product.marque} ${name}`}>
          <Photo src={productPhotos(product).principale} alt="" />
        </Link>
        <Distinctions product={product} />
      </div>
      <div className="card-copy">
        <h3><strong>{product.marque}</strong> – {product.ligne?.trim() || name}</h3>
        {!bundle && <>
          {specs.length > 0 && <p className="card-specs">{specs.join(" – ")}</p>}
          <Strength value={product.puissance} showLabel />
        </>}
        <div className="card-actions">
          <Link className="button button-outline card-price" href={hasPrice ? productLink(product.sku, returnQuery, "achat") : url}
            aria-label={hasPrice ? `Choisir le conditionnement de ${product.marque} ${name}` : `Voir la fiche de ${product.marque} ${name}`}>
            <span>{hasPrice ? <>
              {!bundle && <small className="card-price-caption">Moy</small>}
              {formatPrice(amount)}{!bundle && <> <small>/ cigare</small></>}
            </> : stockLabel(product) || "Conditionnement indisponible"}</span>
            <span className="card-price-arrow" aria-hidden="true">→</span>
          </Link>
          <ProductActions product={product} />
        </div>
      </div>
    </article>
  );
}
