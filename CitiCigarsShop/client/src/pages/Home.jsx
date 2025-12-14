import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroCarousel from '@/components/home/HeroCarousel';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import PromoSection from '@/components/home/PromoSection';
import CartDrawer from '@/components/cart/CartDrawer';
import { useContent } from '@/context/ContentContext';
import i18n from '@/i18n';

const Home = () => {
  const { content } = useContent();
  const [, setLocation] = useLocation();
  const brandStory = content?.home?.brandStory || {};
  
  const [, setLang] = useState(i18n.language);
  
  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);
  
  const t = (key) => i18n.t(key);

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
              <span className="text-secondary text-4xl font-serif block mb-4">{brandStory.icon || '⚜'}</span>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">{brandStory.title || t('home.brandStory.title')}</h2>
              <p className="text-lg text-primary-foreground/80 leading-relaxed mb-8">
                {brandStory.text || t('home.brandStory.text')}
              </p>
              <button 
                onClick={() => setLocation(brandStory.ctaLink || '/about')}
                className="border border-secondary text-secondary px-8 py-3 rounded hover:bg-secondary hover:text-primary transition-colors uppercase tracking-widest text-sm font-bold"
              >
                {brandStory.ctaText || t('home.brandStory.cta')}
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
