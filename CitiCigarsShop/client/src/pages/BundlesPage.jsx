import React, { useContext, useState } from 'react';
import { useProducts } from '@/context/ProductContext';
import ProductCard from '@/components/catalogue/ProductCard';
import ProductDetail from '@/components/catalogue/ProductDetail';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';

export default function BundlesPage() {
  const { products } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Filtrer uniquement les bundles visibles
  const bundles = products.filter(p => p.type === 'bundle' && p.inCatalogue !== false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <div className="bg-destructive text-white py-12">
            <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
                🎁 Découvrez Nos Assortiments
            </h1>
            <p className="text-xl opacity-90">
                Collections soigneusement sélectionnées pour explorer l'univers des cigares premium
            </p>
            </div>
        </div>
        
        {/* Catégories */}
        <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                <div className="text-4xl mb-3">🏭</div>
                <h3 className="font-bold text-lg mb-2">Coffrets Fabricants</h3>
                <p className="text-sm text-gray-600">
                Taste Samplers, coffrets prestige des grandes marques
                </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="font-bold text-lg mb-2">Sélections Maison</h3>
                <p className="text-sm text-gray-600">
                Nos experts composent des assortiments thématiques
                </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-lg text-center">
                <div className="text-4xl mb-3">🎓</div>
                <h3 className="font-bold text-lg mb-2">Packs Découverte</h3>
                <p className="text-sm text-gray-600">
                Initiation, dégustation guidée, exploration
                </p>
            </div>
            </div>
            
            {/* Grille Bundles */}
            {bundles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bundles.map(bundle => (
                  <ProductCard 
                    key={bundle.sku} 
                    product={bundle} 
                    onOpenDetails={setSelectedProduct}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-xl text-gray-500">
                  Aucun assortiment disponible pour le moment
                </p>
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
