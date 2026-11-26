import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Heart, Menu, ShoppingBag } from "lucide-react";
import { Toaster } from "sonner";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import { CartProvider, useCart } from "@/context/CartContext";
import { ConfigProvider } from "@/context/ConfigContext";
import { WishlistProvider, useWishlist } from "@/context/WishlistContext";
import { queryClient } from "@/lib/queryClient";
import CartPage from "./CartPage";
import CheckoutPage from "./CheckoutPage";
import { BusinessPage, EventsPage, GiftsPage, HomePage, QuotePage } from "./Occasions";
import ProductDetail from "./ProductDetail";
import ProductGrid from "./ProductGrid";
import { dnaUrl, productionRelease } from "./release";
import logo from "./logo.webp";
import "../index.css";
import "./storefront.css";

function Header() {
  const [path] = useLocation();
  const { itemCount } = useCart();
  const { wishlist } = useWishlist();
  const [menu, setMenu] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="CitiCigars, accueil" onClick={() => setMenu(false)}>
          <img src={logo} width="52" height="50" alt="" />
          <span className="brand-text">CitiCigars<small>CAMEROUN</small></span>
        </Link>
        <Link className="catalogue-shortcut" href="/catalogue" aria-current={path === "/catalogue" ? "page" : undefined}
          onClick={() => setMenu(false)}>Catalogue</Link>
        <nav id="navigation-vitrine" className={`main-nav${menu ? " is-open" : ""}`} aria-label="Navigation principale">
          <Link href="/catalogue" aria-current={path === "/catalogue" ? "page" : undefined} onClick={() => setMenu(false)}>Catalogue</Link>
          {dnaUrl && <a className="dna-nav-link" href={dnaUrl}>Ton ADN Cigare</a>}
          {[["/coffrets", "Coffrets cadeaux"], ["/entreprises", "Entreprises"], ["/evenements", "Événements"]].map(([href, label]) =>
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
              onClick={() => setMenu(false)}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link className="favorites-link" href="/wishlist" aria-label={`Favoris (${wishlist.length})`} onClick={() => setMenu(false)}>
            <Heart aria-hidden="true" />{wishlist.length > 0 && <span className="favorites-count">{wishlist.length}</span>}
          </Link>
          <Link className="cart-link" href="/panier" aria-label={`Panier (${itemCount})`} onClick={() => setMenu(false)}>
            <ShoppingBag aria-hidden="true" /><span className="cart-label">Panier</span><span className="cart-count">{itemCount}</span>
          </Link>
          <button type="button" className="menu-toggle" aria-label="Menu" aria-expanded={menu}
            aria-controls="navigation-vitrine" onClick={() => setMenu(!menu)}><Menu aria-hidden="true" /></button>
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
          <Route path="/" component={HomePage} />
          <Route path="/catalogue" component={ProductGrid} />
          <Route path="/produit/:sku">{({ sku }) => <ProductDetail key={sku} sku={sku} />}</Route>
          <Route path="/p/:sku">{({ sku }) => <ProductDetail key={sku} sku={sku} />}</Route>
          <Route path="/wishlist">{() => <ProductGrid favoritesOnly />}</Route>
          <Route path="/panier" component={CartPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/coffrets" component={GiftsPage} />
          <Route path="/entreprises" component={BusinessPage} />
          <Route path="/evenements" component={EventsPage} />
          <Route path="/devis" component={QuotePage} />
          <Route><div className="shell empty-state"><h1>Parcours hors de la copie de test</h1></div></Route>
        </Switch>
      </main>
      <footer className="site-footer"><div className="shell footer-inner">
        <strong className="footer-brand">CitiCigars</strong>
        {productionRelease ? <nav aria-label="Informations légales" className="legal-links">
          <a href="/cgv">CGV</a><a href="/privacy">Confidentialité</a><a href="/mentions">Mentions légales</a>
        </nav> : <span>Aperçu de préproduction</span>}
      </div></footer>
      <Toaster />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <ConfigProvider>
      <WishlistProvider>
        <CartProvider><Router base={productionRelease ? "" : import.meta.env.BASE_URL.replace(/\/$/, "")}><Storefront /></Router></CartProvider>
      </WishlistProvider>
    </ConfigProvider>
  </QueryClientProvider>,
);
