import React from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/context/ProductContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import Button from '../shared/Button';
import { formatPrice } from '@/utils/priceCalculator';
import { useLocation } from 'wouter';
import generatedImage from '@assets/generated_images/single_premium_cigar.png';

const CartItem = ({ item, product, onUpdateQuantity, onRemove }) => {
  const imageSrc = product?.imagePrincipale || item.image || generatedImage;
  const qteBoite = product?.qteBoite || product?.quantiteBoite || item.qteBoite;
  const typePack = product?.typePack || product?.quantitePack || item.typePack;
  return (
    <div className="flex gap-4 py-4 border-b border-border/50">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
        <img 
          src={imageSrc} 
          alt={item.modele} 
          className="h-full w-full object-cover"
        />
      </div>
      
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-serif font-bold text-primary text-sm">
              {item.marque}{item.ligne ? `, ${item.ligne}` : ''} — {item.format === 'unitaire' ? item.modele : item.format === 'pack' ? `Pack de ${typePack || '?'}` : `Boîte de ${qteBoite || '?'}`}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 font-mono">SKU: {item.sku}</p>
          </div>
          <p className="font-bold font-mono text-sm whitespace-nowrap ml-2">{formatPrice(item.prixTotal)}</p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 border rounded-md p-1">
            <button 
              onClick={() => onUpdateQuantity(item.id, -1)}
              className="p-1 hover:bg-accent rounded disabled:opacity-50"
              disabled={item.quantite <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-medium w-6 text-center">{item.quantite}</span>
            <button 
              onClick={() => onUpdateQuantity(item.id, 1)}
              className="p-1 hover:bg-accent rounded"
            >
              <Plus size={14} />
            </button>
          </div>
          
          <button 
            onClick={() => onRemove(item.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const CartDrawer = () => {
  const { isOpen, setIsOpen, items, updateQuantity, removeFromCart, total } = useCart();
  const [, setLocation] = useLocation();

  const handleCheckout = () => {
    setIsOpen(false);
    setLocation('/checkout');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 border-b bg-muted/10">
          <SheetTitle className="font-serif text-2xl text-primary flex items-center gap-2">
            🛒 Votre Panier <span className="text-base font-sans font-normal text-muted-foreground">({items.length})</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center text-4xl">🚬</div>
              <h3 className="font-serif text-xl text-primary">Votre humidor est vide</h3>
              <p className="text-muted-foreground max-w-[200px]">Découvrez notre sélection exclusive et commencez votre collection.</p>
              <Button onClick={() => setIsOpen(false)} variant="secondary">Explorer le catalogue</Button>
            </div>
          ) : (
            <div className="divide-y">
              {items.map(item => (
                <CartItem 
                  key={item.id} 
                  item={item} 
                  onUpdateQuantity={updateQuantity} 
                  onRemove={removeFromCart} 
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {items.length > 0 && (
          <div className="p-6 border-t bg-muted/10 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Livraison</span>
                <span className="text-xs italic">Calculé à l'étape suivante</span>
              </div>
              <div className="flex justify-between text-lg font-bold font-serif text-primary pt-2 border-t">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <Button className="w-full h-12 text-lg" onClick={handleCheckout}>
              Commander
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
