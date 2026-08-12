import React from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import ProductDetail from "@/components/catalogue/ProductDetail";
import { useProducts } from "@/context/ProductContext";

const ProductPage = () => {
  const { sku } = useParams();
  const [, navigate] = useLocation();
  const { products } = useProducts();

  const decodedSku = decodeURIComponent(sku || "").toUpperCase();

  const product = products.find(
    (p) => String(p.sku || "").toUpperCase() === decodedSku
  );

  const loading = products.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-background">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p>Chargement du cigare...</p>
          </div>
        ) : !product ? (
          <div className="container mx-auto px-4 py-20 text-center">
            <h1 className="text-3xl font-serif font-bold text-primary">
              Cigare introuvable
            </h1>
            <p className="mt-3 text-muted-foreground">
              La référence {decodedSku} n’est pas disponible dans le catalogue.
            </p>

            <button
              onClick={() => navigate("/catalogue")}
              className="mt-6 text-primary font-semibold hover:underline"
            >
              Retour au catalogue
            </button>
          </div>
        ) : (
          <div className="min-h-[60vh]" />
        )}
      </main>

      <Footer />
      <CartDrawer />

      {product && (
        <ProductDetail
          product={product}
          isOpen={true}
          onClose={() => navigate("/catalogue")}
        />
      )}
    </div>
  );
};

export default ProductPage;
