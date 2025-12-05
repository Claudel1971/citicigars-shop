import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductGrid from '@/components/catalogue/ProductGrid';
import CartDrawer from '@/components/cart/CartDrawer';

const Catalogue = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-background">
        <ProductGrid />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export default Catalogue;