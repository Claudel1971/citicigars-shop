import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SearchBar = ({ value, onChange, resultCount }) => {
  return (
    <div className="relative max-w-xl mx-auto w-full">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors h-5 w-5" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher une marque, un modèle, une origine..."
          className={cn(
            "w-full pl-10 pr-10 py-3 rounded-full border border-input bg-background shadow-sm transition-all",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "placeholder:text-muted-foreground/70"
          )}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {value && (
        <div className="absolute top-full left-0 w-full text-center mt-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-2">
          {resultCount} cigare{resultCount !== 1 ? 's' : ''} trouvé{resultCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
