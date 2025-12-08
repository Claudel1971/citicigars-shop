import React, { useState } from "react";
import { ShoppingCart, Crown } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useConfig } from "@/context/ConfigContext";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/priceCalculator";
import generatedImage from "@assets/generated_images/single_premium_cigar.png";
import Button from "../shared/Button";
import LazyProductImage from "./LazyProductImage";

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

function getMainImage(p) {
  return (
    p.imagePrincipale ||
    p.imageSolo ||
    p.imagePack ||
    p.imagePack4 ||
    p.imagePack5 ||
    p.imageBoite ||
    generatedImage
  );
}

const ProductCard = ({ product, onOpenDetails }) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { config } = useConfig();
  const { isMember } = config;
  const isWishlisted = isInWishlist(product.sku);

  const produit = { ...product };

  const [selectedFormat, setSelectedFormat] = useState("unitaire");

  const mainImage = getMainImage(produit);

  const imageForFormat = (format) => {
    switch (format) {
      case "pack":
        return (
          produit.imagePack ||
          produit.imagePack4 ||
          produit.imagePack5 ||
          mainImage
        );
      case "boite":
        return produit.imageBoite || mainImage;
      default:
        return produit.imagePrincipale || produit.imageSolo || mainImage;
    }
  };

  const currentImage = imageForFormat(selectedFormat);

  const handleQuickAdd = (format, quantity = 1) => {
    let price;
    const promo = produit.promotions;

    if (produit.type === "bundle") {
      const bundlePromo = promo?.bundle;
      const unitPromo = promo?.unitaire;
      const activePromo = (bundlePromo?.actif ? bundlePromo : null) || (unitPromo?.actif ? unitPromo : null);
      const basePrice = produit.prixUnitaire || produit.prixBundle;
      price = (activePromo?.actif && activePromo?.prixPromo)
        ? activePromo.prixPromo
        : basePrice;
    } else {
      switch (format) {
        case "pack":
          price = (promo?.pack?.actif && promo.pack.prixPromo)
            ? promo.pack.prixPromo
            : produit.prixPack;
          break;
        case "boite":
          price = (promo?.boite?.actif && promo.boite.prixPromo)
            ? promo.boite.prixPromo
            : produit.prixBoite;
          break;
        default:
          price = (promo?.unitaire?.actif && promo.unitaire.prixPromo)
            ? promo.unitaire.prixPromo
            : produit.prixUnitaire;
      }
    }

    addToCart(produit, format, quantity, price, imageForFormat(format));
  };

  if (produit.type === "bundle") {
    return (
      <div className="group relative bg-card rounded-lg border border-border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden">
        <div
          className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer"
          onClick={() => onOpenDetails && onOpenDetails(produit)}
        >
          <LazyProductImage
            sku={produit.sku}
            format="principale"
            existingImages={produit.imagePrincipale ? produit : null}
            alt={produit.marque}
            className="w-full h-64 bg-gray-50"
          />

          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
              <span>🎁</span>
              <span>ASSORTIMENT</span>
            </div>
          </div>
          
          {(() => {
            const bundlePromo = produit.promotions?.bundle;
            const unitPromo = produit.promotions?.unitaire;
            const activePromo = (bundlePromo?.actif ? bundlePromo : null) || (unitPromo?.actif ? unitPromo : null);
            return activePromo?.pourcentage > 0 && (
              <div className="absolute bottom-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                -{activePromo.pourcentage}%
              </div>
            );
          })()}

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(produit);
            }}
            className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-all shadow-sm"
          >
            {isWishlisted ? (
              <span className="text-red-500 text-lg">♥</span>
            ) : (
              <span className="text-gray-400 text-lg">♡</span>
            )}
          </button>
        </div>

        <div className="p-5">
          <h3 className="text-xl font-serif font-bold text-primary mb-1 leading-tight group-hover:text-secondary transition-colors">
            {produit.marque}
            {produit.ligne ? `, ${produit.ligne}` : ""}
          </h3>

          <p className="text-sm text-muted-foreground mb-3">
            {produit.description || `Assortiment de ${produit.quantiteBoite || produit.qteBoite || 4} cigares premium`}
          </p>

          <div>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 mb-3 border border-amber-100">
              <div className="flex justify-between items-center py-1 px-1">
                <span className="text-sm font-bold text-primary">
                  Prix :
                </span>
                <div className="text-right">
                  {(() => {
                    const bundlePromo = produit.promotions?.bundle;
                    const unitPromo = produit.promotions?.unitaire;
                    const activePromo = (bundlePromo?.actif ? bundlePromo : null) || (unitPromo?.actif ? unitPromo : null);
                    const basePrice = produit.prixUnitaire || produit.prixBundle;
                    const isPromo = activePromo?.actif && activePromo?.prixPromo;
                    return isPromo ? (
                      <>
                        <span className="text-xs line-through text-muted-foreground mr-1">
                          {formatPrice(basePrice)}
                        </span>
                        <span className="text-sm font-bold text-destructive">
                          {formatPrice(activePromo.prixPromo)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {formatPrice(basePrice)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs border border-input hover:bg-accent"
                onClick={() => onOpenDetails && onOpenDetails(produit)}
              >
                Détails
              </Button>

              <Button
                size="sm"
                className="flex-1 gap-1 bg-primary hover:bg-primary/90 text-white"
                onClick={() => handleQuickAdd("bundle", 1)}
              >
                <ShoppingCart size={14} />
                <span className="text-xs">Ajouter</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-card rounded-lg border border-border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden">
      <div
        className="relative h-64 bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer"
        onClick={() => onOpenDetails && onOpenDetails(produit)}
      >
        <LazyProductImage
          sku={produit.sku}
          format={selectedFormat}
          existingImages={produit.imagePrincipale ? produit : null}
          alt={produit.marque}
          className="w-full h-64 bg-gray-50"
        />

        {(produit.badges?.coty ||
          produit.badges?.top25 ||
          (produit.badges?.rating && produit.badges.rating !== "NA")) && (
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {produit.badges?.coty && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                <Crown className="w-3 h-3" />
                <span>Cigare de l'année ({produit.badges.top25Year})</span>
              </div>
            )}

            {produit.badges?.top25 && !produit.badges?.coty && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                <span>
                  ★ TOP {produit.badges.top25Rang} ({produit.badges.top25Year})
                </span>
              </div>
            )}

            {produit.badges?.rating && produit.badges.rating !== "NA" && (
              <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold text-amber-700 border border-amber-200 shadow-sm">
                CA {produit.badges.rating} pts
              </div>
            )}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(produit);
          }}
          className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-all shadow-sm"
        >
          {isWishlisted ? (
            <span className="text-red-500 text-lg">♥</span>
          ) : (
            <span className="text-gray-400 text-lg">♡</span>
          )}
        </button>

        {produit.promotions?.unitaire?.actif && produit.promotions.unitaire.pourcentage > 0 && (
            <div className="absolute bottom-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              -{produit.promotions.unitaire.pourcentage}%
            </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-xl font-serif font-bold text-primary mb-1 leading-tight group-hover:text-secondary transition-colors">
          {produit.marque}
          {produit.ligne ? `, ${produit.ligne}` : ""}
          {produit.origine || produit.pays ? (
            <span className="text-sm text-muted-foreground font-sans font-normal ml-2">
              · {produit.origine || produit.pays}
            </span>
          ) : null}
        </h3>

        {(produit.vitole || produit.format) && (
          <p className="text-sm text-muted-foreground mb-2">
            {produit.vitole && produit.vitole !== produit.format
              ? `${produit.vitole}, `
              : ""}
            {produit.format || produit.vitole}
            {produit.longueur && produit.diametre
              ? ` (${produit.longueur} × ${produit.diametre})`
              : ""}
          </p>
        )}

        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((niveau) => (
              <div
                key={niveau}
                className={`w-4 h-1.5 rounded-[1px] border ${
                  niveau <= produit.puissance
                    ? "bg-[#B37A2A] border-[#B37A2A]"
                    : "bg-transparent border-[#E6D2B5]"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            {getPuissanceLabel(produit.puissance)}
          </p>
        </div>

        {/* 🔧 FIX: Removed flex-1 spacer that caused excessive spacing */}

        <div>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 mb-3 border border-amber-100">
            <div
              className="flex justify-between items-center py-1 cursor-pointer hover:bg-black/5 rounded px-1 transition-colors"
              onClick={() => setSelectedFormat("unitaire")}
            >
              <span
                className={cn(
                  "text-sm text-gray-600",
                  selectedFormat === "unitaire" && "font-bold text-primary",
                )}
              >
                Unité :
              </span>
              <div className="text-right">
                {produit.promotions?.unitaire?.actif && produit.promotions.unitaire.prixPromo ? (
                  <>
                    <span className="text-xs line-through text-muted-foreground mr-1">
                      {formatPrice(produit.prixUnitaire)}
                    </span>
                    <span className="text-sm font-bold text-destructive">
                      {formatPrice(produit.promotions.unitaire.prixPromo)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-primary">
                    {formatPrice(produit.prixUnitaire)}
                  </span>
                )}
              </div>
            </div>

            {produit.prixPack > 0 && (
              <div
                className="flex justify-between items-center py-1 border-t border-amber-200 cursor-pointer hover:bg-black/5 rounded px-1 transition-colors"
                onClick={() => setSelectedFormat("pack")}
              >
                <span
                  className={cn(
                    "text-sm text-gray-600",
                    selectedFormat === "pack" && "font-bold text-primary",
                  )}
                >
                  Pack ({produit.quantitePack || produit.typePack || 5}) :
                </span>
                {produit.promotions?.pack?.actif && produit.promotions.pack.prixPromo ? (
                  <>
                    <span className="text-xs line-through text-muted-foreground mr-1">
                      {formatPrice(produit.prixPack)}
                    </span>
                    <span className="text-sm font-bold text-destructive">
                      {formatPrice(produit.promotions.pack.prixPromo)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-orange-800">
                    {formatPrice(produit.prixPack)}
                  </span>
                )}
              </div>
            )}

            {produit.prixBoite > 0 && (
              <div
                className="flex justify-between items-center py-1 border-t border-amber-200 cursor-pointer hover:bg-black/5 rounded px-1 transition-colors"
                onClick={() => setSelectedFormat("boite")}
              >
                <span
                  className={cn(
                    "text-sm text-gray-600",
                    selectedFormat === "boite" && "font-bold text-primary",
                  )}
                >
                  Boîte ({produit.quantiteBoite || produit.qteBoite || 10}) :
                </span>
                {produit.promotions?.boite?.actif && produit.promotions.boite.prixPromo ? (
                  <>
                    <span className="text-xs line-through text-muted-foreground mr-1">
                      {formatPrice(produit.prixBoite)}
                    </span>
                    <span className="text-sm font-bold text-destructive">
                      {formatPrice(produit.promotions.boite.prixPromo)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-orange-800">
                    {formatPrice(produit.prixBoite)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs border border-input hover:bg-accent"
              onClick={() => onOpenDetails && onOpenDetails(produit)}
            >
              Détails
            </Button>

            <Button
              size="sm"
              className="flex-1 gap-1 bg-primary hover:bg-primary/90 text-white"
              onClick={() => handleQuickAdd(selectedFormat)}
            >
              <ShoppingCart size={14} />
              <span className="text-xs">Ajouter</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
