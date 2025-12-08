export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    currencyDisplay: 'symbol'
  }).format(amount).replace('XOF', 'FCFA'); 
};

export const formatPrice = (price) => {
  // Changed to FCFA as per new requirements in addendum (e.g., "45000 FCFA")
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price).replace('XOF', 'FCFA');
};

export const arrondir500 = (val) => {
  return Math.round(val / 500) * 500;
};

export const calculateDiscountedPrice = (price, percentage) => {
  if (!percentage || percentage <= 0) return price;
  const discounted = price * (1 - percentage / 100);
  return arrondir500(discounted);
};

export const determinerTypePack = (format, config) => {
  if (!format) return 5;
  const parts = format.toLowerCase().split('x');
  if (parts.length < 2) return 5;
  const ring = parseFloat(parts[1].trim());
  
  // Use config if provided, otherwise default heuristic
  if (config && config.packDefaut) {
    return ring <= 54 ? config.packDefaut.ring54AndLess : config.packDefaut.ring55AndMore;
  }
  
  return ring <= 54 ? 5 : 4;
};
