import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { formatPrice } from "@/utils/priceCalculator";
import { whatsappMessageLink } from "@/utils/whatsappGenerator";
import { content } from "./content";
import { purchaseOptions } from "./catalogue";
import { confirmed, useCatalogue } from "./resources";
import { blackFridayOpen, dnaUrl, productionRelease } from "./release";
import ProductCard, { useCardPhotos } from "./ProductCard";
import salon from "./salon-accueil.webp";
import closed from "./coffret-cuivre-ferme.webp";
import open from "./coffret-cuivre-ouvert.webp";
import "./occasions.css";

export function HomePage() {
  const catalogue = confirmed(useCatalogue());
  const { photoFor, markUnavailable } = useCardPhotos();
  const [, navigate] = useLocation();
  const reveal = useRef();
  const [opening, setOpening] = useState(false);
  useEffect(() => () => clearTimeout(reveal.current), []);
  const showGifts = (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    if (opening) return;
    setOpening(true);
    reveal.current = setTimeout(() => navigate("/coffrets"), 520);
  };
  const featured = catalogue?.filter((product) => photoFor(product) && purchaseOptions(product).length).slice(0, 4);
  return <>
    <section className="hero">
      <div className="hero-copy"><div>
        <p className="eyebrow">Maison de cigares · Cameroun</p>
        <h1>Le temps<br /><em>d’un cigare.</em></h1>
        <p className="hero-intro">Explorez notre sélection de cigares en packs, boîtes et assortiments.</p>
        <div className="hero-actions">
          <Link className="button button-gold" href="/catalogue">Explorer le catalogue</Link>
          {dnaUrl && <a className="text-link hero-dna-link" href={dnaUrl}>Découvrir ton ADN Cigare</a>}
        </div>
      </div></div>
      <figure className="hero-photo"><img src={salon} alt={content.hero.alt} width="1200" height="655" /></figure>
    </section>
    <section className="shell home-gift">
      <Link href="/coffrets" onClick={showGifts} className={`gift-story gift-story-link${opening ? " is-opening" : ""}`}>
        <div className="gift-story-photo">
          <img src={closed} alt={content.giftPresentation.closed.alt} />
          <img className="gift-story-reveal" src={open} alt="" />
        </div>
        <div className="gift-story-copy">
          <p className="eyebrow">Coffrets cadeaux</p>
          <h2>L’art d’offrir.</h2>
          <p>Quatre coffrets pour marquer une occasion.</p>
          <span className="button button-primary">Découvrir les coffrets <span aria-hidden="true">→</span></span>
        </div>
      </Link>
    </section>
    {featured?.length > 0 && <section className="shell home-selection">
      <div className="section-heading">
        <div><p className="eyebrow">La sélection CitiCigars</p><h2>À découvrir</h2></div>
        <Link className="text-link" href="/catalogue">Tout le catalogue</Link>
      </div>
      <div className="product-grid">{featured.map((product) => <ProductCard key={product.sku} product={product}
        photo={photoFor(product)} onPhotoError={markUnavailable} />)}</div>
    </section>}
    <section className="shell home-occasions">
      <div className="occasion-pair">
        <article><p className="eyebrow">Entreprises</p><h3>Un cadeau à votre image.</h3>
          <Link className="text-link" href="/entreprises">Découvrir l’offre entreprises</Link></article>
        <article><p className="eyebrow">Événements</p><h3>Un moment à partager.</h3>
          <Link className="text-link" href="/evenements">Préparer un événement</Link></article>
      </div>
    </section>
  </>;
}

export function GiftsPage() {
  const player = useRef();
  const dialog = useRef();
  const [current, setCurrent] = useState(null);
  const blackFriday = productionRelease && blackFridayOpen();
  const showVideo = (gift) => {
    setCurrent(gift);
    player.current.src = gift.media.video;
    dialog.current.showModal();
    player.current.play().catch(() => {});
  };
  const clearVideo = () => {
    player.current.pause();
    player.current.removeAttribute("src");
    player.current.load();
    setCurrent(null);
  };
  return <section className="shell occasion-page">
    <div className="gift-story gift-story-open">
      <div className="gift-story-photo"><img src={open} alt={content.giftPresentation.open.alt} /></div>
      <div className="gift-story-copy">
        <p className="eyebrow">Coffrets cadeaux</p><h1>L’art d’offrir.</h1><p>{content.occasions.coffrets.intro}</p>
      </div>
    </div>
    {blackFriday && <section className="empty-state gift-offer" aria-labelledby="black-friday">
      <h2 id="black-friday">Black Friday · 26 au 30 novembre</h2>
      <p>10 % de rabais sur les coffrets. Personnalisation offerte sur Silver, Gold et Diamond.</p>
    </section>}
    <div className="gift-grid">
      {content.gifts.map((gift) => <article key={gift.id} className="gift-card" data-gift-card={gift.id}>
        <figure className="gift-picture"><img src={gift.media.photo} alt={gift.media.alt} loading="lazy" /></figure>
        <div className="gift-card-copy">
          <div className="gift-card-heading">
            <div className="gift-card-name"><h2>{gift.name}</h2>
              {blackFriday && <del className="gift-price gift-price-reference">{formatPrice(gift.price)}</del>}
              <strong className="gift-price">{formatPrice(blackFriday ? gift.price * .9 : gift.price)}</strong></div>
            <button type="button" className="gift-video-button" onClick={() => showVideo(gift)}>
              <span className="gift-play" aria-hidden="true" /> Voir la vidéo
            </button>
          </div>
          {blackFriday && gift.personnalisable && <p className="fine-print">Personnalisation offerte</p>}
          <div className="gift-actions">
            {productionRelease ?
              <a className="button button-primary" target="_blank" rel="noopener noreferrer"
                href={whatsappMessageLink(`Bonjour CitiCigars, je souhaiterais un devis pour le coffret ${gift.name}${blackFriday ? " dans le cadre de l’offre Black Friday" : ""}.`)}>Demander un devis</a>
              : <Link className="button button-primary" href={`/devis?coffret=${gift.id}`}>Préparer un devis</Link>}
            <Link className="button button-outline" href={`/entreprises?coffret=${gift.id}`}>Tarifs entreprises</Link>
          </div>
        </div>
      </article>)}
    </div>
    <p className="fine-print">{productionRelease ? "Coffrets sur devis via WhatsApp."
      : "Coffrets sur devis. Les demandes préparées ici restent des brouillons."}</p>
    <dialog ref={dialog} className="gift-dialog" onClose={clearVideo}>
      <div className="dialog-head"><h2>{current?.name}</h2>
        <button type="button" className="dialog-close" aria-label="Fermer la vidéo" onClick={() => dialog.current.close()}>×</button></div>
      <video ref={player} controls playsInline preload="none" aria-label={current ? `Vidéo du coffret ${current.name}` : "Vidéo du coffret"} />
    </dialog>
  </section>;
}

function OtherBusinessProducts() {
  const [draft, setDraft] = useState("");
  const prepare = (event) => {
    event.preventDefault();
    const fields = [...new FormData(event.currentTarget)];
    setDraft(["Bonjour CitiCigars, je souhaite un devis pour d’autres produits.",
      ...fields.map(([label, value]) => label + " : " + String(value).trim())].join("\n"));
  };
  return <details className="business-other">
    <summary>Commander d’autres produits</summary>
    <form className="order-form" data-order-form="other" onSubmit={prepare} onChange={() => setDraft("")}>
      <div className="order-fields">
        <label className="order-field">Nom et prénom<input name="Nom" autoComplete="name" maxLength={120} required /></label>
        <label className="order-field">Entreprise<input name="Entreprise" autoComplete="organization" maxLength={120} required /></label>
        <label className="order-field">WhatsApp<input name="WhatsApp" type="tel" autoComplete="tel" maxLength={30} required /></label>
        <label className="order-field">Date souhaitée<input name="Date souhaitée" type="date" required /></label>
      </div>
      <label className="order-field">Produits souhaités et quantités
        <textarea name="Produits et quantités" rows={3} maxLength={600} required /></label>
      <p className="order-form-note">Le montant sera précisé sur devis.</p>
      <button className="button button-primary" type="submit">Préparer un devis</button>
      {draft && (productionRelease
        ? <a className="text-link" href={whatsappMessageLink(draft)} target="_blank" rel="noopener noreferrer">Continuer sur WhatsApp</a>
        : <pre className="draft" aria-live="polite">{draft}</pre>)}
    </form>
  </details>;
}

export function BusinessPage() {
  const requested = new URLSearchParams(useSearch()).get("coffret");
  const [gift, setGift] = useState(() => content.gifts.find((item) => item.id === requested) || content.gifts.at(-1));
  const [quantity, setQuantity] = useState(() => String(gift.volumeThresholds[0]));
  const limit = Math.floor(Number.MAX_SAFE_INTEGER / Math.max(...content.gifts.map(({ price }) => price)));
  const qty = Number(quantity);
  const valid = Number.isSafeInteger(qty) && qty >= 1 && qty <= limit;
  const tier = valid ? gift.volumeThresholds.findLastIndex((threshold) => qty >= threshold) : -1;
  const percent = content.businessDiscounts[tier] || 0;
  const unit = Math.round(gift.price * (100 - percent) / 100);
  const nextTier = gift.volumeThresholds[tier + 1];
  const remaining = nextTier - qty;
  const price = (value) => formatPrice(value).replace(/F\s*CFA/g, "FCFA");

  return <section className="shell occasion-page business-page">
    <div className="page-heading"><p className="eyebrow">Entreprises</p><h1>Commander en volume.</h1>
      <p>Choisissez un coffret et une quantité pour estimer votre budget après remise.</p></div>
    <section className="business-calculator" aria-labelledby="business-rates-title">
      <div className="business-choices">
        <h2 id="business-rates-title">Coffrets cadeaux</h2>
        <fieldset className="business-gifts">
          <legend className="sr-only">Choisir un coffret</legend>
          <div className="business-gift-options">
            {content.gifts.map((item) => <label className="business-gift" key={item.id}>
              <input className="sr-only" type="radio" name="business-gift" value={item.id}
                checked={item.id === gift.id} onChange={() => setGift(item)} />
              <img src={item.media.photo} alt="" />
              <span className="business-gift-name">{item.name}</span>
              <span className="business-gift-price">{price(item.price)}</span>
            </label>)}
          </div>
        </fieldset>
        <div className="business-order-quantity">
          <label htmlFor="business-quantity">Nombre de coffrets</label>
          <div className="business-stepper">
            <button type="button" aria-label="Retirer un coffret" disabled={!valid || qty === 1}
              onClick={() => setQuantity(String(qty - 1))}>−</button>
            <input id="business-quantity" type="number" inputMode="numeric" min={1} max={limit} step={1}
              required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <button type="button" aria-label="Ajouter un coffret" disabled={valid && qty === limit}
              onClick={() => setQuantity(String(valid ? qty + 1 : 1))}>+</button>
          </div>
        </div>
      </div>
      <section className="business-tiers" aria-labelledby="business-tiers-title">
        <h3 id="business-tiers-title">Paliers de remise</h3>
        <div className="business-tier-options">
          {gift.volumeThresholds.map((threshold, index) => <button type="button" className="business-tier"
            key={threshold} aria-current={tier === index ? "true" : undefined}
            onClick={() => setQuantity(String(threshold))}>
            <strong>−{content.businessDiscounts[index]} %</strong><span>Dès {threshold} coffrets</span>
          </button>)}
        </div>
        {valid && <p className="business-next-tier">{nextTier
          ? "Encore " + remaining + (remaining === 1 ? " coffret" : " coffrets") + " pour atteindre −" + content.businessDiscounts[tier + 1] + " %."
          : "Remise maximale atteinte."}</p>}
      </section>
      <aside className="business-estimate" aria-labelledby="business-estimate-title">
        <h2 id="business-estimate-title">Votre estimation</h2>
        <div className="business-result" role="status" aria-atomic="true">
          {valid ? <>
            <p className="business-result-product">{gift.name} · {qty} coffret{qty === 1 ? "" : "s"}</p>
            <div className="business-total"><span>Total estimé</span><strong>{price(unit * qty)}</strong>
              {percent > 0 && <span className="business-savings">Économie de {price((gift.price - unit) * qty)}</span>}
            </div>
            <dl className="business-breakdown">
              <div><dt>Prix unitaire de base</dt><dd>{price(gift.price)}</dd></div>
              <div><dt>Remise appliquée</dt><dd>{percent ? "−" + percent + " %" : "Aucune"}</dd></div>
              <div><dt>Prix unitaire après remise</dt><dd>{price(unit)}</dd></div>
            </dl>
          </> : <p className="business-result-empty">Indiquez un nombre entier de coffrets pour voir le total.</p>}
        </div>
        {valid ? <Link className="button button-gold" href={"/devis?entreprise=1&coffret=" + gift.id + "&quantite=" + qty}>Préparer un devis</Link>
          : <button className="button button-gold" type="button" disabled>Préparer un devis</button>}
      </aside>
    </section>
    <OtherBusinessProducts />
  </section>;
}

export function EventsPage() {
  const event = content.occasions.evenements;
  return <section className="shell occasion-page">
    <div className="page-heading"><p className="eyebrow">{event.label}</p><h1>{event.title}</h1><p>{event.intro}</p></div>
    <div className="occasion-pair">
      {event.details.map(([label, text]) => <article key={label}><h2>{label}</h2><p>{text}</p></article>)}
    </div>
    <Link className="button button-primary event-quote" href="/devis?evenement=1">{event.action}</Link>
  </section>;
}

export function QuotePage() {
  const params = new URLSearchParams(useSearch());
  const gift = content.gifts.find((item) => item.id === params.get("coffret"));
  const [draft, setDraft] = useState("");
  const requestTitle = params.has("evenement") ? "un événement" : params.has("entreprise") ? "une commande d’entreprise" : "un coffret cadeau";
  const quoteText = [
    `Bonjour CitiCigars, je souhaiterais un devis pour ${requestTitle}.`,
    gift && `Coffret ${gift.name}`,
    /^[1-9]\d*$/.test(params.get("quantite") || "") && `Quantité ${params.get("quantite")}`,
  ].filter(Boolean).join("\n");
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDraft(["Demande de devis CitiCigars", ...data.entries()].map((entry) =>
      Array.isArray(entry) ? entry.filter(Boolean).join(" · ") : entry).join("\n"));
  };
  if (productionRelease) return <section className="shell occasion-page">
    <div className="page-heading"><h1>Demander un devis</h1><p>Échange avec CitiCigars sur WhatsApp.</p></div>
    <a className="button button-primary" href={whatsappMessageLink(quoteText)}
      target="_blank" rel="noopener noreferrer">Continuer sur WhatsApp</a>
  </section>;
  return <section className="shell occasion-page">
    <div className="page-heading"><h1>Préparer un devis</h1><p>Brouillon local, sans envoi ni commande.</p></div>
    <form className="quote-form" onSubmit={submit}>
      <label className="quote-field">Nom<input name="Nom" autoComplete="name" required /></label>
      {params.has("entreprise") && <label className="quote-field">Entreprise<input name="Entreprise" autoComplete="organization" required /></label>}
      <label className="quote-field">WhatsApp<input name="WhatsApp" type="tel" autoComplete="tel" required /></label>
      <label className="quote-field">Date souhaitée<input name="Date souhaitée" type="date" required /></label>
      {gift && <>
        <label className="quote-field">Coffret<input name="Coffret" readOnly value={gift.name} /></label>
        <label className="quote-field">Quantité<input name="Quantité" type="number" min="1" defaultValue={params.get("quantite") || 1} required /></label>
      </>}
      <label className="quote-field">{params.has("evenement") ? "Décris ton événement" : "Précisions"}
        <textarea name="Précisions" rows="4" required={!gift} /></label>
      <button className="button button-primary" type="submit">Préparer le brouillon</button>
    </form>
    {draft && <section className="empty-state draft"><h2>Brouillon de devis</h2><pre>{draft}</pre></section>}
  </section>;
}
