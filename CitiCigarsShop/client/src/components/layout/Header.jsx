import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { ShoppingCart, Heart, Menu, X } from 'lucide-react';
import i18n from '@/i18n';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useContent } from '@/context/ContentContext';
import { cn } from '@/lib/utils';
import LanguageSelector from '../LanguageSelector';

const Header = () => {
  const [location] = useLocation();
  const [, setLang] = useState(i18n.language);
  const t = (key) => i18n.t(key);
  
  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);
  
  const { itemCount, setIsOpen } = useCart();
  const { wishlist } = useWishlist();
  const { content } = useContent();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const defaultNavLinks = [
    { href: '/', label: t('nav.home'), highlight: false, icon: '' },
    { href: '/catalogue', label: t('nav.cigars'), highlight: false, icon: '' },
    { href: '/assortiments', label: t('nav.assortments'), highlight: true, icon: '🎁' },
    { href: '/promotions', label: t('nav.promotions'), highlight: false, icon: '' },
  ];

  const rawNavLinks = content?.header?.menuItems || defaultNavLinks;
  const navLinks = rawNavLinks.map(item => ({
    href: item.href || '/',
    label: item.label || '',
    highlight: item.highlight === true,
    icon: item.icon || ''
  }));
  const logo = content?.header?.logo || { url: '', alt: 'CitiCigars', href: '/' };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex min-h-16 items-center justify-between px-4 md:px-8 py-3">
        {/* Logo */}
        <Link 
          href={logo.href || "/"} 
          className="flex items-center gap-2"
          aria-label={logo.alt || "CitiCigars"}
        >
          {logo.url ? (
            <img 
              src={logo.url} 
              alt={logo.alt || "CitiCigars"} 
              className="h-auto max-h-24 md:max-h-28 w-auto object-contain"
            />
          ) : (
            <span className="font-serif text-2xl font-bold text-primary tracking-wide flex items-center gap-2">
              <span className="text-3xl text-secondary">⚜</span> CITI CIGARS
            </span>
          )}
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link, index) => (
            <Link 
              key={link.href || index} 
              href={link.href} 
              className={cn(
                "text-sm font-medium transition-colors hover:text-secondary uppercase tracking-wider",
                location === link.href ? "text-secondary font-bold" : "text-muted-foreground"
              )}
            >
              {link.icon && <span className="mr-1">{link.icon}</span>}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <LanguageSelector />
          
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
            {navLinks.map((link, index) => (
              <Link 
                key={link.href || index} 
                href={link.href} 
                className="text-lg font-medium py-2 px-4 hover:bg-accent rounded-md"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.icon && <span className="mr-1">{link.icon}</span>}
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
