import React from 'react';
import { useProducts } from '@/context/ProductContext';
import { cn } from '@/lib/utils';

const AlphabetNav = ({ activeLetter, onSelectLetter }) => {
  const { products } = useProducts();
  const alphabet = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  
  // Identify available letters from products
  const availableLetters = React.useMemo(() => {
    const letters = new Set();
    products.forEach(p => {
      const firstChar = p.marque.charAt(0).toUpperCase();
      letters.add(firstChar);
    });
    return letters;
  }, [products]);

  return (
    <div className="sticky top-20 z-30 w-full bg-background/95 backdrop-blur border-b py-2 shadow-sm overflow-x-auto scrollbar-hide">
      <div className="container flex items-center justify-between md:justify-center gap-1 md:gap-2 min-w-max px-4">
        <button
          onClick={() => onSelectLetter(null)}
          className={cn(
            "px-3 py-1 text-xs font-bold rounded-full transition-all",
            !activeLetter 
              ? "bg-primary text-primary-foreground scale-110 shadow-md" 
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          TOUS
        </button>
        
        {alphabet.map(letter => {
          const isAvailable = availableLetters.has(letter);
          const isActive = activeLetter === letter;
          
          return (
            <button
              key={letter}
              onClick={() => isAvailable && onSelectLetter(letter)}
              disabled={!isAvailable}
              className={cn(
                "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full transition-all",
                isActive && "bg-primary text-primary-foreground scale-110 shadow-md",
                !isActive && isAvailable && "text-foreground hover:bg-accent hover:scale-105",
                !isActive && !isAvailable && "text-muted-foreground/30 cursor-not-allowed"
              )}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AlphabetNav;
