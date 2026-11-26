export const generateWhatsAppLink = (cartItems, total, customerData) => {
  const amount = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  });
  const formatFCFA = (value) => `${amount.format(value)} FCFA`;
  const itemsList = cartItems
    .map((item) => {
      const nameParts = [item.marque, item.ligne, item.modele]
        .map((part) => typeof part === "string" ? part.trim() : "")
        .filter((part) => part && !/^(null|undefined)$/i.test(part));
      const name = [...new Set(nameParts)].join(" ") || item.sku;
      return `• ${name} - ${item.format} x${item.quantite} = ${formatFCFA(item.prixTotal)}
*SKU:* ${item.sku}`;
    })
    .join("\n\n");

  const message = `🛒 *NOUVELLE COMMANDE CitiCigars*

Client: ${customerData.nom}
Téléphone: ${customerData.telephone} - Ville: ${customerData.ville}

Commande:
${itemsList}

TOTAL: ${formatFCFA(total)}

Commande générée depuis CitiCigars.com`;

  const phoneNumber = "237675784830";
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};
