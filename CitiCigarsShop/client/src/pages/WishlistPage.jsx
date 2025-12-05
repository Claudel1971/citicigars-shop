import React from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import ProductCard from '@/components/catalogue/ProductCard';
import ProductDetail from '@/components/catalogue/ProductDetail';
import { useWishlist } from '@/context/WishlistContext';
import { useLocation } from 'wouter';
import Button from '@/components/shared/Button';
import { Heart } from 'lucide-react';

const WishlistPage = () => {
  const { wishlist } = useWishlist();
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = React.useState(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-background container px-4 py-12 mx-auto">
        <div className="flex items-center gap-4 mb-8">
           <div className="p-3 bg-destructive/10 rounded-full text-destructive">
             <Heart className="h-8 w-8 fill-destructive" />
           </div>
           <h1 className="text-4xl font-serif font-bold text-primary">Mes Favoris</h1>
        </div>

        {wishlist.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
            <h3 className="text-xl font-serif text-muted-foreground">Votre liste de souhaits est vide</h3>
            <p className="text-muted-foreground mt-2 mb-6">Sauvegardez vos coups de cœur pour les retrouver plus tard.</p>
            <Button onClick={() => setLocation('/catalogue')}>Explorer le catalogue</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlist.map(product => (
              <ProductCard 
                key={product.sku} 
                product={product} 
                onOpenDetails={setSelectedProduct} 
              />
            ))}
          </div>
        )}
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
};

export default WishlistPage;
