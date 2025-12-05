import React from 'react';
import { Link, useLocation } from 'wouter';
import { ShoppingCart, Heart, Menu, X, User, Crown } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useConfig } from '@/context/ConfigContext';
import { cn } from '@/lib/utils';
import Button from '../shared/Button';
import { Switch } from '@/components/ui/switch';

const Header = () => {
  const [location] = useLocation();
  const { itemCount, setIsOpen } = useCart();
  const { wishlist } = useWishlist();
  const { config, toggleMemberStatus } = useConfig();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navLinks = [
    { href: '/', label: 'Accueil' },
    { href: '/catalogue', label: 'Cigares' },
    { href: '/assortiments', label: '🎁 Nos Assortiments' },
    { href: '/promotions', label: 'Promotions' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-bold text-primary tracking-wide">
            <span className="text-3xl text-secondary">⚜</span> CITI CIGARS
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} className={cn(
                "text-sm font-medium transition-colors hover:text-secondary uppercase tracking-wider",
                location === link.href ? "text-secondary font-bold" : "text-muted-foreground",
                link.href === '/assortiments' && "text-amber-600 font-bold hover:text-amber-700"
              )}>
                {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Member Toggle (Mock) */}
          <div className="hidden lg:flex items-center gap-2 mr-4 px-3 py-1 bg-secondary/10 rounded-full border border-secondary/20">
             <Switch checked={config.isMember} onCheckedChange={toggleMemberStatus} id="member-mode" />
             <label htmlFor="member-mode" className="text-xs font-bold text-primary cursor-pointer flex items-center gap-1">
                {config.isMember ? <Crown size={14} className="text-secondary fill-secondary" /> : <User size={14} />}
                {config.isMember ? "MEMBRE CLUB" : "VISITEUR"}
             </label>
          </div>

          <Link href="/wishlist" className="relative p-2 hover:bg-accent rounded-full transition-colors text-primary">
              <Heart className={cn("h-6 w-6", wishlist.length > 0 && "fill-destructive stroke-destructive")} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white animate-in zoom-in">
                  {wishlist.length}
                </span>
              )}
          </Link>

          <button 
            onClick={() => setIsOpen(true)}
            className="relative p-2 hover:bg-accent rounded-full transition-colors text-primary"
          >
            <ShoppingCart className="h-6 w-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-primary-foreground animate-in zoom-in">
                {itemCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-primary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t p-4 bg-background">
          <nav className="flex flex-col gap-4">
            <div className="flex items-center justify-between py-2 px-4 bg-secondary/10 rounded-md">
                <span className="text-sm font-bold">Mode Membre</span>
                <Switch checked={config.isMember} onCheckedChange={toggleMemberStatus} />
            </div>
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className="text-lg font-medium py-2 px-4 hover:bg-accent rounded-md" onClick={() => setIsMobileMenuOpen(false)}>
                  {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
