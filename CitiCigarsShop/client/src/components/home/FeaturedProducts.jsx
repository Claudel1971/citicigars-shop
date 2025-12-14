import React, { useState, useEffect } from 'react';
import { useProducts } from '@/context/ProductContext';
import ProductCard from '../catalogue/ProductCard';
import ProductDetail from '../catalogue/ProductDetail';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import Button from '../shared/Button';
import i18n from '@/i18n';

const FeaturedProducts = () => {
  const { products } = useProducts();
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = React.useState(null);
  const [, setLang] = useState(i18n.language);

  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);

  const t = (key) => i18n.t(key);

  const featured = React.useMemo(() => {
    return products.filter(p => p.coupDeCoeur === true).slice(0, 4);
  }, [products]);

  if (products.length === 0) return (
      <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
  );

  if (featured.length === 0) return null;

  return (
    <section className="py-20 bg-background">
      <div className="container px-4 md:px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-2">{t('home.coupsDeCoeur.title')}</h2>
            <p className="text-muted-foreground">{t('home.coupsDeCoeur.subtitle')}</p>
          </div>
          <Button variant="ghost" onClick={() => setLocation('/catalogue')} className="hidden md:flex">
            {t('home.coupsDeCoeur.viewAll')}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(product => (
            <ProductCard 
              key={product.sku} 
              product={product} 
              onOpenDetails={setSelectedProduct} 
            />
          ))}
        </div>

        <div className="mt-10 text-center md:hidden">
           <Button variant="outline" onClick={() => setLocation('/catalogue')}>
            {t('home.coupsDeCoeur.viewAll')}
          </Button>
        </div>
      </div>

      <ProductDetail 
        product={selectedProduct} 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </section>
  );
};

export default FeaturedProducts;
