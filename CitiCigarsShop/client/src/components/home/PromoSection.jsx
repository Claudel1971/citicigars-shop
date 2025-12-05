import React from 'react';
import { useProducts } from '@/context/ProductContext';
import ProductCard from '../catalogue/ProductCard';
import ProductDetail from '../catalogue/ProductDetail';
import { Tag, Clock } from 'lucide-react';

const PromoSection = () => {
  const { products } = useProducts();
  const [selectedProduct, setSelectedProduct] = React.useState(null);

  const promos = React.useMemo(() => {
    return products.filter(p => 
        p.promotions?.unitaire?.actif || 
        p.promotions?.pack?.actif || 
        p.promotions?.boite?.actif
    ).slice(0, 4);
  }, [products]);

  if (promos.length === 0) return null;

  return (
    <section className="py-20 bg-muted/30 border-y border-border/50">
      <div className="container px-4 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-full text-destructive">
                <Tag className="h-8 w-8" />
            </div>
            <div>
                <h2 className="text-3xl font-serif font-bold text-primary">Offres Spéciales</h2>
                <p className="text-muted-foreground">Profitez de nos meilleures remises.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-destructive font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-destructive/20">
             <Clock size={18} />
             <span>Offres limitées dans le temps</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {promos.map(product => (
            <ProductCard 
              key={product.sku} 
              product={product} 
              onOpenDetails={setSelectedProduct} 
            />
          ))}
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

export default PromoSection;
