import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('citicigars-cart');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('citicigars-cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product, format, quantity, price, imageOverride = null) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === `${product.sku}-${format}`);
      if (existing) {
        toast.success(`Quantité mise à jour pour ${product.marque} ${product.modele}`);
        return prev.map(item => 
          item.id === existing.id 
            ? { ...item, quantite: item.quantite + quantity, prixTotal: (item.quantite + quantity) * price }
            : item
        );
      }
      
      toast.success(`${product.marque} ${product.modele} ajouté au panier`);
      
      // Determine correct image if not overridden
      const getImageForFormat = (prod, fmt) => {
        switch(fmt) {
          case 'pack': return prod.imagePack || prod.imagePrincipale;
          case 'boite': return prod.imageBoite || prod.imagePrincipale;
          case 'unitaire':
          default: return prod.imageSolo || prod.imagePrincipale;
        }
      };

      const finalImage = imageOverride || getImageForFormat(product, format);

      return [...prev, {
        id: `${product.sku}-${format}`,
        sku: product.sku,
        marque: product.marque,
        modele: product.modele,
        ligne: product.ligne,
        format,
        quantite: quantity,
        prixUnitaire: price,
        prixTotal: price * quantity,
        image: finalImage,
        type: product.type,
        qteBoite: product.qteBoite || product.quantiteBoite,
        typePack: product.typePack || product.quantitePack
      }];
    });
    setIsOpen(true);
  };

  const removeFromCart = (itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, delta) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantite + delta);
        return { ...item, quantite: newQty, prixTotal: newQty * item.prixUnitaire };
      }
      return item;
    }));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + item.prixTotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantite, 0);

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      isOpen, 
      setIsOpen,
      total,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
};
