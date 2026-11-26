export const generateWhatsAppLink = (cartItems, total, customerData, formatMoney = (amount) => `${amount.toFixed(2)} $`) => {
  const itemsList = cartItems
    .map((item) => {
      return `• ${item.marque} ${item.modele} - ${item.format} x${item.quantite} = ${formatMoney(item.prixTotal)}
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

  const phoneNumber = "237675784830";
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};
