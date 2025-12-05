import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroCarousel from '@/components/home/HeroCarousel';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import PromoSection from '@/components/home/PromoSection';
import CartDrawer from '@/components/cart/CartDrawer';

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroCarousel />
        <FeaturedProducts />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent w-3/4 mx-auto my-10"></div>
        <PromoSection />
        
        {/* Brand Story Teaser */}
        <section className="py-20 bg-primary text-primary-foreground text-center">
           <div className="container max-w-3xl mx-auto px-4">
              <span className="text-secondary text-4xl font-serif block mb-4">⚜</span>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">L'Excellence sans Compromis</h2>
              <p className="text-lg text-primary-foreground/80 leading-relaxed mb-8">
                Citi Cigars est né d'une passion pour les terroirs d'exception. Nous parcourons le monde pour sélectionner 
                les vitoles qui racontent une histoire, celle du temps, de la patience et du savoir-faire.
              </p>
              <button className="border border-secondary text-secondary px-8 py-3 rounded hover:bg-secondary hover:text-primary transition-colors uppercase tracking-widest text-sm font-bold">
                Notre Histoire
              </button>
           </div>
        </section>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
};

export default Home;
