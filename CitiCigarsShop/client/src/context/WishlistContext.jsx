import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('citicigars-wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('citicigars-wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  const toggleWishlist = (product) => {
    setWishlist(prev => {
      const exists = prev.find(p => p.sku === product.sku);
      if (exists) {
        toast.info(`${product.marque} retiré des favoris`);
        return prev.filter(p => p.sku !== product.sku);
      }
      toast.success(`${product.marque} ajouté aux favoris`);
      return [...prev, product];
    });
  };

  const isInWishlist = (sku) => wishlist.some(p => p.sku === sku);

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};
