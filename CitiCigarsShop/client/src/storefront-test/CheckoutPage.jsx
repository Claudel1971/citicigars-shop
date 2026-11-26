import React, { useState } from "react";
import { Link } from "wouter";
import { useCart } from "@/context/CartContext";
import CheckoutForm from "@/components/cart/CheckoutForm";
import { generateWhatsAppLink } from "@/utils/whatsappGenerator";
import { formatPrice } from "@/utils/priceCalculator";
import { purchaseOptions } from "./catalogue";
import { LoadState } from "./ProductGrid";
import { useCatalogue } from "./resources";

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

export default function CheckoutPage() {
  const { items } = useCart();
  const resource = useCatalogue();
  const catalogue = !resource.isError && resource.data;
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const quote = catalogue && priceCart(items, catalogue);
  const preview = async (customer) => {
    setDraft("");
    setNotice("");
    const latest = await resource.refetch();
    const live = latest.isSuccess && priceCart(items, latest.data);
    if (!live || live.items.some((item, index) => item.prixUnitaire !== quote.items[index].prixUnitaire)) {
      setNotice("Le panier doit être vérifié avant de préparer le brouillon.");
      return;
    }
    const link = new URL(generateWhatsAppLink(live.items, live.total, customer, formatPrice));
    setDraft(link.searchParams.get("text"));
  };
  return <section className="shell checkout-preview">
    <Link className="back-link" href="/panier">Retour au panier</Link>
    <p className="fine-print">Préproduction · brouillon local, sans envoi ni commande.</p>
    {catalogue && resource.isFetching && <p role="status">Vérification du panier…</p>}
    {!catalogue ? <LoadState resource={resource} /> : quote ?
      <CheckoutForm previewQuote={quote} onPreview={preview} /> :
      <p role="alert">Un conditionnement est indisponible. Vérifie ton panier.</p>}
    {notice && <p role="alert">{notice}</p>}
    {draft && <section className="empty-state draft" aria-live="polite">
      <h2>Brouillon WhatsApp</h2><pre id="whatsapp-draft">{draft}</pre>
    </section>}
  </section>;
}
