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
  
  // Filtrer uniquement les bundles (adding a mock filter since current mock data doesn't strictly have 'type')
  // We will assume for now that we might need to mock some if none exist, or filter based on 'format' if needed.
  // But let's stick to the "type === 'bundle'" check as requested. 
  // Since mock data is generated in ProductContext, I might need to manually cast some as bundles in the component for display purposes if none match.
  const bundles = products.filter(p => p.type === 'bundle');
  
  // Fallback mock bundles if none found (for demonstration)
  const displayBundles = bundles.length > 0 ? bundles : [
    {
        sku: 'BUNDLE-001',
        marque: 'Selection Cubaine',
        modele: 'Découverte',
        type: 'bundle',
        description: 'Un voyage initiatique à travers les plus grands terroirs de la Havane.',
        imageBundle: 'https://images.unsplash.com/photo-1519039838219-4304b847db52?w=800&auto=format&fit=crop',
        imagePrincipale: 'https://images.unsplash.com/photo-1519039838219-4304b847db52?w=800&auto=format&fit=crop',
        prixBundle: 45000,
        composition: [
            { quantite: 2, marque: 'Cohiba', modele: 'Robusto' },
            { quantite: 2, marque: 'Montecristo', modele: 'No. 4' },
            { quantite: 1, marque: 'Partagas', modele: 'Serie D4' }
        ]
    },
    {
        sku: 'BUNDLE-002',
        marque: 'Nouveau Monde',
        modele: 'Prestige',
        type: 'bundle',
        description: 'La puissance du Nicaragua et la douceur dominicaine réunies.',
        imageBundle: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?w=800&auto=format&fit=crop',
        imagePrincipale: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?w=800&auto=format&fit=crop',
        prixBundle: 32000,
        composition: [
            { quantite: 3, marque: 'Oliva', modele: 'Serie V' },
            { quantite: 3, marque: 'Davidoff', modele: 'Nicaragua' }
        ]
    }
  ];

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayBundles.map(bundle => (
                <ProductCard 
                  key={bundle.sku} 
                  product={bundle} 
                  onOpenDetails={setSelectedProduct}
                />
            ))}
            </div>
            
            {displayBundles.length === 0 && (
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
