import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart } from "@/context/CartContext";
import Button from "../shared/Button";
import { formatPrice } from "@/utils/priceCalculator";
import {
  ShoppingCart,
  Heart,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import generatedImage from "@assets/generated_images/single_premium_cigar.png";
import apiService from "@/services/apiService";

function getPuissanceLabel(puissance) {
  const labels = {
    1: "Léger",
    2: "Léger-Moyen",
    3: "Moyen",
    4: "Medium-Full",
    5: "Corsé",
  };
  return labels[puissance] || "";
}

const imageCache = new Map();

const ProductDetail = ({ product, isOpen, onClose }) => {
  const { addToCart } = useCart();
  const isBundle = product?.type === "bundle";
  const [selectedFormat, setSelectedFormat] = useState(
    isBundle ? "bundle" : "unitaire",
  );
  const [images, setImages] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(false);

  useEffect(() => {
    if (product?.type === "bundle") {
      setSelectedFormat("bundle");
    } else {
      setSelectedFormat("unitaire");
    }
  }, [product?.sku, product?.type]);

  useEffect(() => {
    if (!isOpen || !product?.sku) {
      setImages(null);
      return;
    }

    const fetchImages = async () => {
      if (imageCache.has(product.sku)) {
        setImages(imageCache.get(product.sku));
        return;
      }

      setImagesLoading(true);
      try {
        const imgData = await apiService.getProductImages(product.sku);
        if (imgData) {
          imageCache.set(product.sku, imgData);
          setImages(imgData);
        }
      } catch (err) {
        console.error(`Error loading images for ${product.sku}:`, err);
      } finally {
        setImagesLoading(false);
      }
    };

    fetchImages();
  }, [isOpen, product?.sku]);

  if (!product) return null;

  // ---------- PRIX : on lit uniquement ce qui vient de l’admin ----------
  const getPrice = (fmt) => {
    // Bundles : on prend prixBundle (ou prixUnitaire) + promo bundle/unitaire
    if (isBundle || fmt === "bundle") {
      const bundlePromo = product.promotions?.bundle;
      const unitPromo = product.promotions?.unitaire;
      const activePromo =
        (bundlePromo?.actif ? bundlePromo : null) ||
        (unitPromo?.actif ? unitPromo : null);

      const base = product.prixUnitaire || product.prixBundle || 0;
      const isPromo = activePromo?.actif && activePromo?.prixPromo;

      return {
        base,
        final: isPromo ? activePromo.pr
