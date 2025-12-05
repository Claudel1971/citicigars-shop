import React, { useState } from 'react';
import { useProducts } from '@/context/ProductContext';
import ProductCard from '@/components/catalogue/ProductCard';
import ProductDetail from '@/components/catalogue/ProductDetail';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import { Tag } from 'lucide-react';

export default function PromotionsPage() {
  const { products } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState(null);

  const promos = React.useMemo(() => {
    return products.filter(p =>
      p.promotions?.unitaire?.actif ||
      p.promotions?.pack?.actif ||
      p.promotions?.boite?.actif
    );
  }, [products]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <div className="bg-destructive text-white py-12">
            <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 flex justify-center items-center gap-3">
                <Tag size={40} /> Promotions
            </h1>
            <p className="text-xl opacity-90">
                Nos meilleures offres du moment
            </p>
            </div>
        </div>
        
        <div className="container mx-auto px-4 py-8">
            {promos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {promos.map(product => (
                    <ProductCard 
                        key={product.sku} 
                        product={product} 
                        onOpenDetails={setSelectedProduct}
                    />
                ))}
                </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-xl text-muted-foreground">Aucune promotion active pour le moment.</p>
                </div>
            )}
        </div>
      </main>
      <Footer />
      <CartDrawer />
      <ProductDetail 
        product={selectedProduct} 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
}
