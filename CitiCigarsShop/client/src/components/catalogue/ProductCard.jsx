import React, { useState, useEffect } from "react";
import { ShoppingCart, Crown } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useConfig } from "@/context/ConfigContext";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/priceCalculator";
import generatedImage from "@assets/generated_images/single_premium_cigar.webp";
import Button from "../shared/Button";
import LazyProductImage from "./LazyProductImage";
import i18n from "@/i18n";

function getPuissanceLabel(puissance, t) {
  const labels = {
    1: t("product.strengthLevels.light"),
    2: t("product.strengthLevels.lightMedium"),
    3: t("product.strengthLevels.medium"),
    4: t("product.strengthLevels.mediumFull"),
    5: t("product.strengthLevels.full"),
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

// Fonctions de calcul des prix
const arrondirMultiple = (valeur, multiple = 500) => {
  return Math.round(valeur / multiple) * multiple;
};

const calculerPrixPromo = (prixUnitaire, rabais) => {
  if (!rabais || rabais <= 0) return null;
  const prixAvecRabais = prixUnitaire * (1 - rabais / 100);
  return arrondirMultiple(prixAvecRabais, 500);
};

// Prix pack = prix unitaire (arrondi si promo) × quantité pack (pas d'arrondi supplémentaire)
const calculerPrixPack = (prixUnitaire, qtyPack, rabais = 0) => {
  const prixUnitaireEffectif =
    rabais > 0
      ? arrondirMultiple(prixUnitaire * (1 - rabais / 100), 500)
      : prixUnitaire;
  return prixUnitaireEffectif * qtyPack;
};

// Prix boîte = prix unitaire (arrondi si promo) × quantité boîte (pas d'arrondi supplémentaire)
const calculerPrixBoite = (prixUnitaire, qtyBoite = 25, rabais = 0) => {
  const prixUnitaireEffectif =
    rabais > 0
      ? arrondirMultiple(prixUnitaire * (1 - rabais / 100), 500)
      : prixUnitaire;
  return prixUnitaireEffectif * qtyBoite;
};

const ProductCard = ({ product, onOpenDetails }) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { config } = useConfig();
  const { isMember } = config;
  const isWishlisted = isInWishlist(product.sku);

  const produit = { ...product };

  const [selectedFormat, setSelectedFormat] = useState("unitaire");
  
  const [, setLang] = useState(i18n.language);
  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);
  const t = (key, options) => i18n.t(key, options);

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

  // Image pour le panier selon le format
  const getCartImage = (format) => {
    if (produit.type === 'bundle') {
      return produit.imageBoite || produit.imagePrincipale || generatedImage;
    }
    return imageForFormat(format) || generatedImage;
  };

  const handleQuickAdd = (format, quantity = 1) => {
    let price;
    const promo = produit.promotions;
    const currentPrixUnitaire = produit.prixUnitaire;
    const currentRabais = promo?.unitaire?.pourcentage || 0;
    const qtyPack = produit.quantitePack || produit.typePack || 5;
    const qtyBoite = produit.qteBoite || produit.quantiteBoite || 25;

    if (produit.type === "bundle") {
      const bundlePromo = promo?.bundle;
      const unitPromo = promo?.unitaire;
      const activePromo =
        (bundlePromo?.actif ? bundlePromo : null) ||
        (unitPromo?.actif ? unitPromo : null);
      const basePrice = produit.prixUnitaire || produit.prixBundle;
      const rabais = activePromo?.pourcentage || 0;
      price = rabais > 0 ? calculerPrixPromo(basePrice, rabais) : basePrice;
    } else {
      switch (format) {
        case "pack":
          price = calculerPrixPack(currentPrixUnitaire, qtyPack, currentRabais);
          break;
        case "boite":
          price = calculerPrixBoite(
            currentPrixUnitaire,
            qtyBoite,
            currentRabais,
          );
          break;
        default:
          price =
            currentRabais > 0
              ? calculerPrixPromo(currentPrixUnitaire, currentRabais)
              : currentPrixUnitaire;
      }
    }

    // On envoie l'image correspondant au format sélectionné
    addToCart(produit, format, quantity, price, getCartImage(format));
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
              <span>{t("product.assortment")}</span>
            </div>
          </div>

          {(() => {
            const bundlePromo = produit.promotions?.bundle;
            const unitPromo = produit.promotions?.unitaire;
            const activePromo =
              (bundlePromo?.actif ? bundlePromo : null) ||
              (unitPromo?.actif ? unitPromo : null);
            return (
              activePromo?.pourcentage > 0 && (
                <div className="absolute bottom-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                  -{activePromo.pourcentage}%
                </div>
              )
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
            {t(`bundles.${produit.sku}`, { defaultValue: produit.description }) ||
              t("product.bundleDescription", { count: produit.quantiteBoite || produit.qteBoite || 4 })}
          </p>

          <div>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 mb-3 border border-amber-100">
              <div className="flex justify-between items-center py-1 px-1">
                <span className="text-sm font-bold text-primary">{t("product.price")} :</span>
                <div className="text-right">
                  {(() => {
                    const bundlePromo = produit.promotions?.bundle;
                    const unitPromo = produit.promotions?.unitaire;
                    const activePromo =
                      (bundlePromo?.actif ? bundlePromo : null) ||
                      (unitPromo?.actif ? unitPromo : null);
                    const basePrice =
                      produit.prixUnitaire || produit.prixBundle;
                    const isPromo =
                      activePromo?.actif && activePromo?.prixPromo;
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

            <Button
              size="sm"
              className="w-full bg-[#B87333] hover:bg-[#9A5F2A] text-white"
              onClick={() => onOpenDetails && onOpenDetails(produit)}
            >
              {t("product.viewDetails")}
            </Button>
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
                <span>{t("product.cigarOfYear")} ({produit.badges.top25Year})</span>
              </div>
            )}

            {produit.badges?.top25 && !produit.badges?.coty && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                <span>
                  {produit.badges.top25Rang === 1
                    ? `${t("product.cigarOfYear")}, ${produit.badges.top25Year}`
                    : `#${produit.badges.top25Rang}, ${produit.badges.top25Year}`}
                </span>
              </div>
            )}

            {produit.badges?.rating && produit.badges.rating !== "NA" && (
              <div className="bg-white/95 backdrop-blur-sm w-8 h-8 rounded-full text-sm font-bold text-amber-700 border border-amber-200 shadow-sm flex items-center justify-center">
                {produit.badges.rating}
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

        {produit.promotions?.unitaire?.actif &&
          produit.promotions.unitaire.pourcentage > 0 && (
            <div className="absolute bottom-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              -{produit.promotions.unitaire.pourcentage}%
            </div>
          )}
      </div>

      <div className="p-5">
        <h3 className="text-xl font-serif font-bold text-primary mb-1 leading-tight group-hover:text-secondary transition-colors">
          {produit.marque}
          {produit.ligne ? `, ${produit.ligne}` : ""}
          {(produit.origine || produit.pays) && (
            <span className="text-sm text-muted-foreground font-sans font-normal ml-2">
              · {t(`countries.${produit.origine || produit.pays}`, { defaultValue: produit.origine || produit.pays })}
            </span>
          )}
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
            {getPuissanceLabel(produit.puissance, t)}
          </p>
        </div>

        <div>
          {(() => {
            const currentPrixUnitaire = produit.prixUnitaire;
            const currentRabais =
              produit.promotions?.unitaire?.pourcentage || 0;
            const qtyPack = produit.quantitePack || produit.typePack || 5;
            const qtyBoite = produit.qteBoite || produit.quantiteBoite || 25;

            const prixFinal =
              currentRabais > 0
                ? calculerPrixPromo(currentPrixUnitaire, currentRabais)
                : currentPrixUnitaire;
            const prixPack = calculerPrixPack(
              currentPrixUnitaire,
              qtyPack,
              currentRabais,
            );
            const prixBoite = calculerPrixBoite(
              currentPrixUnitaire,
              qtyBoite,
              currentRabais,
            );

            return (
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
                    {t("product.unit")} :
                  </span>
                  <div className="text-right">
                    {currentRabais > 0 ? (
                      <>
                        <span className="text-xs line-through text-muted-foreground mr-1">
                          {formatPrice(currentPrixUnitaire)}
                        </span>
                        <span className="text-sm font-bold text-destructive">
                          {formatPrice(prixFinal)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {formatPrice(currentPrixUnitaire)}
                      </span>
                    )}
                  </div>
                </div>

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
                    {t("product.pack")} ({qtyPack}) :
                  </span>
                  <span className="text-sm font-semibold text-orange-800">
                    {formatPrice(prixPack)}
                  </span>
                </div>

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
                    {t("product.box")} ({qtyBoite}) :
                  </span>
                  <span className="text-sm font-semibold text-orange-800">
                    {formatPrice(prixBoite)}
                  </span>
                </div>
              </div>
            );
          })()}

          <Button
            size="sm"
            className="w-full bg-[#B87333] hover:bg-[#9A5F2A] text-white"
            onClick={() => onOpenDetails && onOpenDetails(produit)}
          >
            {t("product.viewDetails")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
