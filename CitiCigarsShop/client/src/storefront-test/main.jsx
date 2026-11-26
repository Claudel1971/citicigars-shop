import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Heart, ShoppingBag } from "lucide-react";
import { Toaster } from "sonner";
import { Link, Route, Switch, useLocation } from "wouter";
import { CartProvider, useCart } from "@/context/CartContext";
import { ConfigProvider } from "@/context/ConfigContext";
import { WishlistProvider, useWishlist } from "@/context/WishlistContext";
import { queryClient } from "@/lib/queryClient";
import CartPage from "./CartPage";
import ProductDetail from "./ProductDetail";
import ProductGrid from "./ProductGrid";
import logo from "./logo.webp";
import "./storefront.css";

function Header() {
  const [path] = useLocation();
  const { itemCount } = useCart();
  const { wishlist } = useWishlist();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/catalogue" aria-label="CitiCigars, catalogue">
          <img src={logo} width="52" height="50" alt="" />
          <span className="brand-text">CitiCigars<small>CAMEROUN</small></span>
        </Link>
        <Link className="catalogue-shortcut" href="/catalogue" aria-current={path === "/catalogue" ? "page" : undefined}>Catalogue</Link>
        <div className="header-actions">
          <Link className="favorites-link" href="/wishlist" aria-label={`Favoris (${wishlist.length})`}>
            <Heart aria-hidden="true" />{wishlist.length > 0 && <span className="favorites-count">{wishlist.length}</span>}
          </Link>
          <Link className="cart-link" href="/panier" aria-label={`Panier (${itemCount})`}>
            <ShoppingBag aria-hidden="true" /><span className="cart-label">Panier</span><span className="cart-count">{itemCount}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Storefront() {
  const [path] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  return (
    <>
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <Header />
      <main id="contenu" tabIndex={-1}>
        <Switch>
          <Route path="/" component={ProductGrid} />
          <Route path="/catalogue" component={ProductGrid} />
          <Route path="/produit/:sku">{({ sku }) => <ProductDetail key={sku} sku={sku} />}</Route>
          <Route path="/p/:sku">{({ sku }) => <ProductDetail key={sku} sku={sku} />}</Route>
          <Route path="/wishlist">{() => <ProductGrid favoritesOnly />}</Route>
          <Route path="/panier" component={CartPage} />
          <Route><div className="shell empty-state"><h1>Parcours hors de la copie de test</h1></div></Route>
        </Switch>
      </main>
      <footer className="site-footer"><div className="shell footer-inner">
        <strong className="footer-brand">CitiCigars</strong><span>Copie de test privée</span>
      </div></footer>
      <Toaster />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <ConfigProvider>
      <WishlistProvider>
        <CartProvider><Storefront /></CartProvider>
      </WishlistProvider>
    </ConfigProvider>
  </QueryClientProvider>,
);
