import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart } from "@/context/CartContext";
import Button from "../shared/Button";
import { formatPrice } from "@/utils/priceCalculator";
import { ShoppingCart, Heart, Loader2 } from "lucide-react";
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

/* === mêmes helpers que dans ProductCard ========================= */

const arrondirMultiple = (valeur, multiple = 500) => {
  return Math.round(valeur / multiple) * multiple;
};

const calculerPrixPromo = (prixUnitaire, rabais) => {
  if (!rabais || rabais <= 0) return prixUnitaire;
  const prixAvecRabais = prixUnitaire * (1 - rabais / 100);
  return arrondirMultiple(prixAvecRabais, 500);
};

// Prix pack = prix unitaire (arrondi si promo) × quantité pack
const calculerPrixPack = (prixUnitaire, qtyPack, rabais = 0) => {
  const prixUnitaireEffectif =
    rabais > 0 ? calculerPrixPromo(prixUnitaire, rabais) : prixUnitaire;
  return prixUnitaireEffectif * qtyPack;
};

// Prix boîte = prix unitaire (arrondi si promo) × quantité boîte
const calculerPrixBoite = (prixUnitaire, qtyBoite = 25, rabais = 0) => {
  const prixUnitaireEffectif =
    rabais > 0 ? calculerPrixPromo(prixUnitaire, rabais) : prixUnitaire;
  return prixUnitaireEffectif * qtyBoite;
};

/* ================================================================= */

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

  /* === PRIX : même logique que ProductCard ======================= */

  const getPrice = (fmt) => {
    const currentPrixUnitaire = product.prixUnitaire || 0;
    const currentRabais = product.promotions?.unitaire?.pourcentage || 0;
    const qtyPack = product.quantitePack || product.typePack || 5;
    const qtyBoite = product.qteBoite || product.quantiteBoite || 25;

    // Bundles : même logique que dans ProductCard
    if (isBundle || fmt === "bundle") {
      const bundlePromo = product.promotions?.bundle;
      const unitPromo = product.promotions?.unitaire;
      const activePromo =
        (bundlePromo?.actif ? bundlePromo : null) ||
        (unitPromo?.actif ? unitPromo : null);

      const basePrice = product.prixUnitaire || product.prixBundle || 0;
      const rabais = activePromo?.pourcentage || 0;
      const final = rabais > 0
        ? calculerPrixPromo(basePrice, rabais)
        : basePrice;

      return {
        base: basePrice,
        final,
        isPromo: rabais > 0,
        pct: rabais,
      };
    }

    // Cigares standards
    switch (fmt) {
      case "pack": {
        const base = currentPrixUnitaire * qtyPack; // prix sans rabais (pour le barré)
        const final = calculerPrixPack(
          currentPrixUnitaire,
          qtyPack,
          currentRabais,
        );
        return {
          base,
          final,
          isPromo: currentRabais > 0,
          pct: currentRabais,
        };
      }
      case "boite": {
        const base = currentPrixUnitaire * qtyBoite;
        const final = calculerPrixBoite(
          currentPrixUnitaire,
          qtyBoite,
          currentRabais,
        );
        return {
          base,
          final,
          isPromo: currentRabais > 0,
          pct: currentRabais,
        };
      }
      case "unitaire":
      default: {
        const base = currentPrixUnitaire;
        const final =
          currentRabais > 0
            ? calculerPrixPromo(currentPrixUnitaire, currentRabais)
            : currentPrixUnitaire;
        return {
          base,
          final,
          isPromo: currentRabais > 0,
          pct: currentRabais,
        };
      }
    }
  };

  /* === images ==================================================== */

  const getImageByFormat = (fmt) => {
    if (!images) return generatedImage;

    if (isBundle || fmt === "bundle") {
      const hasBothImages = images.imagePrincipale && images.imageBoite;
      if (hasBothImages) return images.imageBoite;
      return (
        images.imagePrincipale ||
        images.imageBoite ||
        images.imagePack ||
        generatedImage
      );
    }

    switch (fmt) {
      case "pack": {
        const packQty = product.quantitePack || product.typePack || 5;
        if (packQty === 4) {
          return images.imagePack4 || images.imagePack || generatedImage;
        }
        if (packQty === 5) {
          return images.imagePack5 || images.imagePack || generatedImage;
        }
        return (
          images.imagePack ||
          images.imagePack4 ||
          images.imagePack5 ||
          generatedImage
        );
      }
      case "boite":
        return images.imageBoite || generatedImage;
      case "unitaire":
      default:
        return images.imageSolo || generatedImage;
    }
  };

  const currentPrice = getPrice(selectedFormat);
  const currentImage = getImageByFormat(selectedFormat);

  const handleAddToCart = () => {
    addToCart(product, selectedFormat, 1, currentPrice.final, currentImage);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background text-foreground border-none shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* LEFT : IMAGE */}
          <div className="relative h-[300px] md:h-full bg-muted flex items-center justify-center p-8 overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10 mix-blend-multiply" />
            {imagesLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}
            <img
              src={currentImage}
              alt={product.modele}
              className={`max-w-full max-h-full object-contain drop-shadow-2xl hover:scale-105 transition-all duration-700 ${
                imagesLoading ? "opacity-30" : "opacity-100"
              }`}
            />

            {/* BADGES (non affichés pour bundles) */}
            {!isBundle && (
              <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
                {product.badges?.coty && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                    <span>🏆 Cigare de l'année ({product.badges.top25Year})</span>
                  </div>
                )}

                {product.badges?.top25 && !product.badges?.coty && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>
                      {product.badges.top25Rang === 1
                        ? `Cigare de l'année, ${product.badges.top25Year}`
                        : `#${product.badges.top25Rang}, ${product.badges.top25Year}`}
                    </span>
                  </div>
                )}

                {product.badges?.rating &&
                  product.badges.rating !== "NA" && (
                    <div className="bg-white/95 backdrop-blur-sm w-8 h-8 rounded-full text-sm font-bold text-amber-700 border border-amber-200 shadow-sm flex items-center justify-center">
                      {product.badges.rating}
                    </div>
                  )}
              </div>
            )}

            {/* BADGE PROMO */}
            {(() => {
              if (isBundle) {
                const bundlePromo = product.promotions?.bundle;
                const unitPromo = product.promotions?.unitaire;
                const activePromo =
                  (bundlePromo?.actif ? bundlePromo : null) ||
                  (unitPromo?.actif ? unitPromo : null);
                return (
                  activePromo?.pourcentage > 0 && (
                    <div className="absolute bottom-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      -{activePromo.pourcentage}%
                    </div>
                  )
                );
              }
              return (
                product.promotions?.unitaire?.actif &&
                product.promotions.unitaire.pourcentage > 0 && (
                  <div className="absolute bottom-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                    -{product.promotions.unitaire.pourcentage}%
                  </div>
                )
              );
            })()}
          </div>

          {/* RIGHT : CONTENU */}
          <div className="p-6 md:p-8 flex flex-col h-full">
            {/* Header produit (identique à avant) */}
            <div className="mb-6">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-xl font-serif font-bold text-primary mb-1 leading-tight">
                    {product.marque}
                    {product.ligne && `, ${product.ligne}`}
                    {!isBundle && (product.origine || product.pays) && (
                      <span className="text-sm text-muted-foreground font-sans font-normal ml-2">
                        · {product.origine || product.pays}
                      </span>
                    )}
                  </h3>

                  {!isBundle && (product.vitole || product.format) && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {product.vitole && product.vitole !== product.format
                        ? `${product.vitole}, `
                        : ""}
                      {product.format}
                      {product.longueur &&
                        product.diametre &&
                        `, ${product.longueur} × ${product.diametre}`}
                    </p>
                  )}

                  {!isBundle && (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((niveau) => (
                          <div
                            key={niveau}
                            className={`w-4 h-1.5 rounded-[1px] border ${
                              niveau <= product.puissance
                                ? "bg-[#B37A2A] border-[#B37A2A]"
                                : "bg-transparent border-[#E6D2B5]"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {getPuissanceLabel(product.puissance)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => e.stopPropagation()}
                  className="ml-4 bg-white bg-opacity-90 p-2 rounded-full hover:bg-opacity-100 transition-all"
                >
                  <Heart className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {product.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            {/* Tabs ou composition bundle */}
            {isBundle ? (
              <div className="flex-1 mb-8">
                {product.composition && product.composition.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-bold text-primary text-sm flex items-center gap-2">
                      <span>📦</span> Composition du bundle
                    </h5>
                    <div className="bg-accent/50 rounded-lg p-3 space-y-0">
                      {product.composition.map((item, idx) => {
                        const ratingStr = item.rating || "";
                        const ratingMatch = ratingStr.match(/(\d+)/);
                        const ratingNum = ratingMatch ? ratingMatch[1] : null;

                        const top25Str = item.top25 || "";
                        const isCoty = top25Str
                          .toLowerCase()
                          .includes("coty");
                        const cotyMatch = top25Str.match(/(\d{4})/);
                        const cotyYear = cotyMatch ? cotyMatch[1] : null;

                        const rankMatch = top25Str.match(/#(\d+)/);
                        const yearMatch = top25Str.match(/(\d{4})/);
                        const top25Rank = rankMatch ? rankMatch[1] : null;
                        const top25Year = yearMatch ? yearMatch[1] : null;

                        return (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm text-foreground border-b border-border py-2 last:border-0"
                          >
                            <span className="font-medium">
                              {item.quantite}x {item.marque} {item.modele}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1 sm:mt-0 sm:text-right">
                              {ratingNum && (
                                <span className="text-amber-700 font-semibold">
                                  note CA : {ratingNum}
                                </span>
                              )}
                              {ratingNum && (isCoty || top25Rank) && (
                                <span className="mx-1">·</span>
                              )}
                              {isCoty && cotyYear && (
                                <span className="text-amber-600 font-bold">
                                  Cigare de l'année, {cotyYear}
                                </span>
                              )}
                              {!isCoty && top25Rank && top25Year && (
                                <span className="text-amber-600 font-bold">
                                  #{top25Rank}, ({top25Year})
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Tabs defaultValue="tasting" className="flex-1 mb-8">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="tasting">Dégustation</TabsTrigger>
                  <TabsTrigger value="pairings">Accords</TabsTrigger>
                  <TabsTrigger value="details">Détails</TabsTrigger>
                </TabsList>

                <TabsContent value="tasting" className="space-y-4">
                  {/* contenu dégustation comme avant */}
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <span className="text-lg">🔥</span>
                      <div>
                        <h5 className="font-bold text-primary text-sm">
                          Premier Tiers
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          Notes boisées, cèdre, touche de poivre blanc.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="text-lg">🔥🔥</span>
                      <div>
                        <h5 className="font-bold text-primary text-sm">
                          Deuxième Tiers
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          Évolution vers des arômes de café torréfié et de cuir.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <span className="text-lg">🔥🔥🔥</span>
                      <div>
                        <h5 className="font-bold text-primary text-sm">
                          Dernier Tiers
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          Finale puissante, terreuse, avec des notes de cacao
                          amer.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pairings" className="space-y-4">
                  {/* idem avant */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-accent/30 p-3 rounded-lg">
                      <h5 className="font-bold text-primary text-sm mb-2">
                        🥃 Boissons
                      </h5>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Rhum Vieux Agricole</li>
                        <li>• Whisky Single Malt</li>
                        <li>• Café Espresso</li>
                      </ul>
                    </div>
                    <div className="bg-accent/30 p-3 rounded-lg">
                      <h5 className="font-bold text-primary text-sm mb-2">
                        🍫 Mets
                      </h5>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Chocolat Noir 80%</li>
                        <li>• Fruits secs</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="details" className="space-y-4">
                  {/* idem avant, placeholders */}
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Cape:</span>
                    <span className="font-medium">Habano Ecuador</span>
                    <span className="text-muted-foreground">Sous-cape:</span>
                    <span className="font-medium">Dominican Republic</span>
                    <span className="text-muted-foreground">Tripe:</span>
                    <span className="font-medium">Nicaragua / Dominican</span>
                    <span className="text-muted-foreground">Ring Gauge:</span>
                    <span className="font-medium">
                      {product.diametre || "N/A"}
                    </span>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Footer : formats + prix total */}
            <div className="mt-auto pt-6 border-t border-border">
              <div className="flex gap-2 mb-4">
                {isBundle
                  ? null
                  : ["unitaire", "pack", "boite"]
                      .filter((fmt) => {
                        if (fmt === "pack") return product.prixPack > 0;
                        if (fmt === "boite") return product.prixBoite > 0;
                        return true;
                      })
                      .map((fmt) => {
                        const p = getPrice(fmt);
                        return (
                          <button
                            key={fmt}
                            onClick={() => setSelectedFormat(fmt)}
                            className={cn(
                              "flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all",
                              selectedFormat === fmt
                                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                : "border-border text-muted-foreground hover:border-primary/50",
                            )}
                          >
                            <span className="block capitalize text-xs mb-1">
                              {fmt === "unitaire"
                                ? "Unité"
                                : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                              {fmt === "pack" &&
                                ` (${
                                  product.quantitePack ||
                                  product.typePack ||
                                  5
                                })`}
                              {fmt === "boite" &&
                                ` (${
                                  product.quantiteBoite ||
                                  product.qteBoite ||
                                  10
                                })`}
                            </span>
                            <span className="font-bold">
                              {formatPrice(p.final)}
                            </span>
                          </button>
                        );
                      })}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Prix Total
                  </div>
                  <div className="flex items-baseline gap-2">
                    {currentPrice.isPromo &&
                    currentPrice.base !== currentPrice.final ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(currentPrice.base)}
                        </span>
                        <span className="text-sm font-bold text-destructive">
                          {formatPrice(currentPrice.final)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {formatPrice(currentPrice.final)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={handleAddToCart}
                  className="flex-1 gap-2"
                >
                  <ShoppingCart size={18} /> Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetail;
