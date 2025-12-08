import React from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { ProductProvider } from "@/context/ProductContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { ConfigProvider } from "@/context/ConfigContext";
import { ContentProvider } from "@/context/ContentContext";

import Home from "@/pages/Home";
import Catalogue from "@/pages/Catalogue";
import WishlistPage from "@/pages/WishlistPage";
import Admin from "@/pages/Admin";
import BundlesPage from "@/pages/BundlesPage";
import PromotionsPage from "@/pages/PromotionsPage";
import AboutPage from "@/pages/AboutPage";
import { CGVPage, PrivacyPage, MentionsPage } from "@/pages/LegalPage";
import CheckoutForm from "@/components/cart/CheckoutForm";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalogue" component={Catalogue} />
      <Route path="/promotions" component={PromotionsPage} />
      <Route path="/assortiments" component={BundlesPage} />
      <Route path="/wishlist" component={WishlistPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/cgv" component={CGVPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/mentions" component={MentionsPage} />
      
      <Route path="/checkout">
         <div className="min-h-screen flex flex-col">
           <Header />
           <main className="flex-1 bg-background">
             <CheckoutForm />
           </main>
           <Footer />
           <CartDrawer />
         </div>
      </Route>

      {/* Admin Routes are handled inside Admin component due to sub-routing */}
      {/* Explicitly handle base /admin and any subpaths with standard wildcard */}
      <Route path="/admin" component={Admin} />
      <Route path="/admin/*" component={Admin} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <ContentProvider>
          <ProductProvider>
            <WishlistProvider>
              <CartProvider>
                <TooltipProvider>
                  <Router />
                  <Toaster />
                </TooltipProvider>
              </CartProvider>
            </WishlistProvider>
          </ProductProvider>
        </ContentProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
