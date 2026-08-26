export const generateWhatsAppLink = (cartItems, total, customerData) => {
  const itemsList = cartItems
    .map((item) => {
      return `• ${item.marque} ${item.modele} - ${item.format} x${item.quantite} = ${item.prixTotal.toFixed(2)} $
*SKU:* ${item.sku}`;
    })
    .join("\n\n");

  const message = `🛒 *NOUVELLE COMMANDE CitiCigars*

Client: ${customerData.nom}
Téléphone: ${customerData.telephone} - Ville: ${customerData.ville}
Email: ${customerData.email}

Commande:
${itemsList}

TOTAL: ${total.toFixed(2)} $

Commande générée depuis CitiCigars.com`;

  const phoneNumber = "237675784830";
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
};
