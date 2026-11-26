import React, { useState } from "react";
import { Link } from "wouter";
import { useCart } from "@/context/CartContext";
import CheckoutForm from "@/components/cart/CheckoutForm";
import { generateWhatsAppLink } from "@/utils/whatsappGenerator";
import { purchaseOptions } from "./catalogue";
import { LoadState } from "./ProductGrid";
import { useCatalogue } from "./resources";
import { productionRelease } from "./release";

function priceCart(items, catalogue) {
  const products = new Map(catalogue.map((product) => [product.sku, product]));
  const priced = items.map((item) => {
    const product = products.get(item.sku);
    const option = product && purchaseOptions(product).find(({ id }) => id === item.format);
    return option && { ...item, modele: item.modele || item.ligne,
      prixUnitaire: option.price, prixTotal: option.price * item.quantite };
  });
  if (priced.some((item) => !item)) return null;
  return { items: priced, total: priced.reduce((sum, item) => sum + item.prixTotal, 0) };
}

function quoteSignature(quote) {
  return quote?.items.map(({ id, quantite, prixUnitaire }) => [id, quantite, prixUnitaire].join(":")).join("|");
}

export default function CheckoutPage() {
  const { items } = useCart();
  const resource = useCatalogue();
  const catalogue = !resource.isError && resource.data;
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState("");
  const quote = catalogue && priceCart(items, catalogue);
  const preview = async (customer) => {
    setDraft(null);
    setNotice("");
    const latest = await resource.refetch();
    const live = latest.isSuccess && priceCart(items, latest.data);
    if (!live || quoteSignature(live) !== quoteSignature(quote)) {
      setNotice("Le panier doit être vérifié avant de préparer le brouillon.");
      return;
    }
    const link = new URL(generateWhatsAppLink(live.items, live.total, customer));
    setDraft({ text: link.searchParams.get("text"), href: link.href, quote: quoteSignature(live) });
  };
  return <section className="shell checkout-preview">
    <Link className="back-link" href="/panier">Retour au panier</Link>
    <p className="fine-print">{productionRelease
      ? "La commande est à confirmer dans WhatsApp. Ton panier reste disponible sur le site."
      : "Préproduction · brouillon local, sans envoi ni commande."}</p>
    {catalogue && resource.isFetching && <p role="status">Vérification du panier…</p>}
    {!catalogue ? <LoadState resource={resource} /> : quote ?
      <CheckoutForm previewQuote={quote} onPreview={preview} handoff={productionRelease} /> :
      <p role="alert">Un conditionnement est indisponible. Vérifie ton panier.</p>}
    {notice && <p role="alert">{notice}</p>}
    {draft && !resource.isFetching && draft.quote === quoteSignature(quote) && <section className="empty-state draft" aria-live="polite">
      <h2>Brouillon WhatsApp</h2><pre id="whatsapp-draft">{draft.text}</pre>
      {productionRelease && <a className="button button-primary" href={draft.href}
        target="_blank" rel="noopener noreferrer" data-whatsapp-handoff>Continuer sur WhatsApp</a>}
    </section>}
  </section>;
}
