const amountFCFA = (amount) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} FCFA`;

export function whatsappMessageLink(message) {
  const phoneNumber = "237675784830";
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export const generateWhatsAppLink = (cartItems, total, customerData, formatMoney = amountFCFA) => {
  const itemsList = cartItems
    .map((item) => {
      const name = [item.marque, item.modele || item.ligne].filter(Boolean).join(" ");
      return `• ${name} - ${item.format} x${item.quantite} = ${formatMoney(item.prixTotal)}
*SKU:* ${item.sku}`;
    })
    .join("\n\n");

  const message = `🛒 *NOUVELLE COMMANDE CitiCigars*

Client: ${customerData.nom}
Téléphone: ${customerData.telephone} - Ville: ${customerData.ville}${customerData.email ? `\nEmail: ${customerData.email}` : ""}

Commande:
${itemsList}

TOTAL: ${formatMoney(total)}

Commande générée depuis CitiCigars.com`;

  return whatsappMessageLink(message);
};
