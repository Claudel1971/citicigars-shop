import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useCart } from "@/context/CartContext";
import { useConfig } from "@/context/ConfigContext";
import { formatPrice } from "@/utils/priceCalculator";
import { cigarDimensions, cigarFormat, isBundle, productName, productPhotos, purchaseOptions, stockLabel } from "./catalogue";
import { LoadState } from "./ProductGrid";
import { Distinctions, Photo, ProductActions, Strength } from "./ProductCard";
import { confirmed, useProduct } from "./resources";
import TastingSheet, { Facts, parseSheet } from "./TastingSheet";

function Gallery({ product, name }) {
  const photos = productPhotos(product);
  const views = [
    ["principale", "Vue d’ensemble"], ["solo", "Le cigare"], ["pack", "Le pack"], ["boite", "La boîte"],
  ].filter(([id]) => photos[id]);
  const [selected, setSelected] = useState("principale");
  const [id, caption] = views.find(([key]) => key === selected) || views[0] || [];
  return (
    <div className="gallery">
      <figure className="gallery-frame gallery-main">
        <Photo src={photos[id]} alt={`${name}${caption ? " · " + caption : ""}`} />
        <Distinctions product={product} />
        <ProductActions product={product} detail />
      </figure>
      {views.length > 1 && <div className="gallery-controls">
        <div className="gallery-thumbs">
          {views.map(([view, title]) => <button type="button" key={view} aria-label={title} aria-pressed={id === view}
            onClick={() => setSelected(view)}><Photo src={photos[view]} alt="" /></button>)}
        </div>
        <p className="gallery-caption">{caption}</p>
      </div>}
    </div>
  );
}

function Purchase({ product, resource, scrollToPurchase }) {
  const heading = useRef(null);
  const pending = useRef(false);
  const active = useRef(true);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const { addToCart, setIsOpen } = useCart();
  const [, navigate] = useLocation();
  const verified = confirmed(resource);
  const options = verified ? purchaseOptions(verified) : [];
  const choice = options.find((option) => option.id === selected) || options[0];

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (scrollToPurchase && heading.current) {
      heading.current.focus({ preventScroll: true });
      heading.current.scrollIntoView({ block: "start" });
    }
  }, [scrollToPurchase]);

  const add = async (event) => {
    event.preventDefault();
    if (!choice || pending.current) return;
    pending.current = true;
    setNotice("");
    try {
      const latest = await resource.refetch();
      if (!active.current || !latest.isSuccess || !latest.data || latest.data.sku !== product.sku) return;
      const current = purchaseOptions(latest.data).find(({ id }) => id === choice.id);
      if (!current || current.price !== choice.price || current.pieces !== choice.pieces) {
        setNotice(current ? "Le prix ou le conditionnement a changé. Vérifie l’offre avant d’ajouter." : "Ce conditionnement est désormais indisponible.");
        return;
      }
      addToCart(latest.data, current.id, 1, current.price, current.image);
      setIsOpen(false);
      navigate("/panier");
    } finally {
      pending.current = false;
    }
  };
  return (
    <div className="product-order">
      <form onSubmit={add}>
        <fieldset>
          <legend id="format-heading" tabIndex={-1} ref={heading}>Choisir le conditionnement</legend>
          {!verified ? <p role="status">Vérification des prix et disponibilités…</p> : !choice ? (
            <p role="status">{stockLabel(verified) || "Aucun conditionnement disponible."}</p>
          ) : (
            <div className="format-options">
              {options.map((option) => <label key={option.id} className="format-option">
                <input type="radio" name="conditionnement" value={option.id} checked={choice.id === option.id}
                  onChange={() => { setSelected(option.id); setNotice(""); }} />
                <span className="format-label">
                  <strong>{option.label}</strong>
                  {option.pieces > 0 && <small>{option.pieces} cigares</small>}
                  <span className="format-price">{option.base !== option.price && <del>{formatPrice(option.base)} </del>}{formatPrice(option.price)}</span>
                </span>
              </label>)}
            </div>
          )}
        </fieldset>
        <div className="buy-bar"><button className="button button-primary" type="submit" disabled={!choice}>Ajouter au panier</button></div>
        {notice && <p role="status">{notice}</p>}
      </form>
    </div>
  );
}

export default function ProductDetail({ sku }) {
  const id = String(sku || "").toUpperCase();
  const resource = useProduct(id);
  const params = new URLSearchParams(useSearch());
  const returnQuery = new URLSearchParams(params.get("retour") || "");
  const back = returnQuery.size ? `/catalogue?${returnQuery}` : "/catalogue";
  const { config } = useConfig();
  const member = config.isMember === true;
  const product = !resource.isError && resource.data;
  const sheet = parseSheet(product?.ficheTechnique);
  return (
    <section className="shell product-page">
      <Link className="back-link" href={back}>Retour au catalogue</Link>
      {!product ? (resource.isSuccess && resource.data === null ? <div className="empty-state"><h1>Cigare introuvable</h1></div>
        : <LoadState resource={resource} />) : (
        <>
          <div className="product-layout">
            <div className="product-heading">
              <p className="eyebrow">{product.marque}</p>
              <h1>{productName(product)}</h1>
              <p className="product-origin">{isBundle(product) ? "Assortiment" : product.pays} · {product.sku}</p>
              {!isBundle(product) && <section className="product-specs">
                <h2>Le cigare</h2>
                <Facts entries={[["Vitole", product.vitole !== cigarFormat(product) && product.vitole], ["Format du cigare", cigarFormat(product)],
                  ["Dimensions", [cigarDimensions(product), product.dimensionsMM].filter(Boolean).join(" · ")],
                  ["Puissance", strengthsExist(product.puissance) && <Strength value={product.puissance} />]]} />
              </section>}
            </div>
            <div className="product-visual">
              <Gallery key={id} product={product} name={productName(product)} />
              {member && sheet?.terroir && <section className="product-specs product-terroir">
                <h2>Terroir</h2>
                <Facts entries={Object.entries({ origine: "Origine", cape: "Cape", sousCape: "Sous-cape", tripe: "Tripe" })
                  .map(([key, label]) => [label, sheet.terroir[key]])} />
              </section>}
            </div>
            <Purchase key={id} product={product} resource={resource} scrollToPurchase={params.get("section") === "achat"} />
          </div>
          {!isBundle(product) && <TastingSheet key={id} sheet={sheet} member={member} />}
        </>
      )}
    </section>
  );
}

function strengthsExist(value) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 5;
}
