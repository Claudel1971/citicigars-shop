import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCart } from "@/context/CartContext";
import Button from "../shared/Button";
import { formatPrice } from "@/utils/priceCalculator";
import { ShoppingCart, Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import generatedImage from "@assets/generated_images/single_premium_cigar.webp";
import apiService from "@/services/apiService";
import i18n from "@/i18n";
import { getProductDisplayDimensions } from "@/utils/cigarDimensions";

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

const imageCache = new Map();

const arrondirMultiple = (valeur, multiple = 500) => {
  return Math.round(valeur / multiple) * multiple;
};

const calculerPrixPromo = (prixUnitaire, rabais) => {
  if (!rabais || rabais <= 0) return prixUnitaire;
  const prixAvecRabais = prixUnitaire * (1 - rabais / 100);
  return arrondirMultiple(prixAvecRabais, 500);
};

const calculerPrixPack = (prixUnitaire, qtyPack, rabais = 0) => {
  const prixUnitaireEffectif =
    rabais > 0 ? calculerPrixPromo(prixUnitaire, rabais) : prixUnitaire;
  return prixUnitaireEffectif * qtyPack;
};

const calculerPrixBoite = (prixUnitaire, qtyBoite = 25, rabais = 0) => {
  const prixUnitaireEffectif =
    rabais > 0 ? calculerPrixPromo(prixUnitaire, rabais) : prixUnitaire;
  return prixUnitaireEffectif * qtyBoite;
};

const parseFicheTechnique = (fiche) => {
  if (!fiche) return null;
  if (typeof fiche === 'object') return fiche;
  try {
    return JSON.parse(fiche);
  } catch (e) {
    return null;
  }
};

const MembershipTeaser = ({ title, features }) => (
  <div className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
    <p className="text-sm text-amber-900 mb-2 font-semibold flex items-center gap-2">
      🔒 {title || "Contenu membre"}
    </p>
    {features && features.length > 0 && (
      <ul className="text-sm text-amber-800 mb-3 list-disc list-inside space-y-1">
        {features.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    )}
    <button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-amber-700 hover:to-orange-700 transition-all shadow-md">
      Devenir membre - 9 900 F/mois
    </button>
  </div>
);

const ProductDetail = ({ product: rawProduct, isOpen, onClose }) => {
  const product = rawProduct ? {
    ...rawProduct,
    ficheTechnique: parseFicheTechnique(rawProduct.ficheTechnique)
  } : rawProduct;
  const displayDimensions = getProductDisplayDimensions(product);
  
  const { addToCart } = useCart();
  const isBundle = product?.type === "bundle";
  const [selectedFormat, setSelectedFormat] = useState(
    isBundle ? "bundle" : "unitaire",
  );
  const [images, setImages] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  
  const [isPremium, setIsPremium] = useState(false);
  
  const [activeTab, setActiveTab] = useState(isPremium ? 'terroir' : 'combustion');

  const [, setLang] = useState(i18n.language);
  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on('languageChanged', handleLangChange);
    return () => i18n.off('languageChanged', handleLangChange);
  }, []);
  const t = (key, options) => i18n.t(key, options);

  useEffect(() => {
    setActiveTab(isPremium ? 'terroir' : 'combustion');
  }, [isPremium]);

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

    const productImages = {
      imagePrincipale: product.imagePrincipale || null,
      imageSolo: product.imageSolo || null,
      imagePack: product.imagePack || null,
      imagePack4: product.imagePack4 || null,
      imagePack5: product.imagePack5 || null,
      imageBoite: product.imageBoite || null,
    };

    const hasImages = Object.values(productImages).some(img => img);
    if (hasImages) {
      setImages(productImages);
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
  }, [isOpen, product?.sku, product?.imagePrincipale, product?.imageSolo, product?.imagePack, product?.imageBoite]);

  if (!product) return null;

  const ficheTechnique = product.ficheTechnique;

  const tabs = isPremium 
    ? [
        { id: 'terroir', label: 'Terroir', icon: '🌍' },
        { id: 'combustion', label: 'Combustion', icon: '🔥' },
        { id: 'aromes', label: 'Arômes', icon: '🌿' },
        { id: 'degustation', label: 'Dégustation', icon: '🍷' }
      ]
    : [
        { id: 'combustion', label: 'Combustion', icon: '🔥' },
        { id: 'aromes', label: 'Arômes', icon: '🌿' },
        { id: 'degustation', label: 'Dégustation', icon: '🍷' }
      ];

  const getPrice = (fmt) => {
    const currentPrixUnitaire = product.prixUnitaire || 0;
    const currentRabais = product.promotions?.unitaire?.pourcentage || 0;
    const qtyPack = product.quantitePack || product.typePack || 5;
    const qtyBoite = product.qteBoite || product.quantiteBoite || 25;

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

    switch (fmt) {
      case "pack": {
        const base = currentPrixUnitaire * qtyPack;
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

  const renderTabContent = () => {
    if (!ficheTechnique) {
      return (
        <div className="text-center py-6 text-muted-foreground text-sm bg-gray-50 rounded-lg">
          Fiche technique non disponible
        </div>
      );
    }

    switch (activeTab) {
      case 'terroir':
        return (
          <div className="space-y-2">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground font-medium">🌍 Origine :</span>
                <span className="font-medium">{ficheTechnique.terroir?.origine || product.pays || "-"}</span>
                <span className="text-muted-foreground font-medium">📦 Cape :</span>
                <span className="font-medium">{ficheTechnique.terroir?.cape || "-"}</span>
                <span className="text-muted-foreground font-medium">🎯 Sous-cape :</span>
                <span className="font-medium">{ficheTechnique.terroir?.sousCape || "-"}</span>
                <span className="text-muted-foreground font-medium">🌿 Tripe :</span>
                <span className="font-medium">{ficheTechnique.terroir?.tripe || "-"}</span>
              </div>
            </div>
          </div>
        );

      case 'combustion':
        return (
          <div className="space-y-3">
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                {ficheTechnique.duree && (
                  <>
                    <span className="text-muted-foreground font-medium">⏱️ Durée :</span>
                    <span className="font-medium">{ficheTechnique.duree}</span>
                  </>
                )}
                {ficheTechnique.combustion?.fumee && (
                  <>
                    <span className="text-muted-foreground font-medium">💨 Type de fumée :</span>
                    <span className="font-medium">{ficheTechnique.combustion.fumee}</span>
                  </>
                )}
              </div>
            </div>

            {isPremium ? (
              <div className="bg-amber-50 p-3 rounded-lg">
                <h5 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                  🌟 Analyse experte
                </h5>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  {ficheTechnique.combustion?.tirage && (
                    <>
                      <span className="text-muted-foreground font-medium">Tirage :</span>
                      <span className="font-medium">{ficheTechnique.combustion.tirage}</span>
                    </>
                  )}
                  {ficheTechnique.combustion?.combustion && (
                    <>
                      <span className="text-muted-foreground font-medium">Combustion :</span>
                      <span className="font-medium">{ficheTechnique.combustion.combustion}</span>
                    </>
                  )}
                  {ficheTechnique.combustion?.cendre && (
                    <>
                      <span className="text-muted-foreground font-medium">Cendre :</span>
                      <span className="font-medium">{ficheTechnique.combustion.cendre}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <MembershipTeaser 
                title="Analyse experte"
                features={["Qualité du tirage", "Comportement de la combustion", "Texture de la cendre"]}
              />
            )}
          </div>
        );

      case 'aromes':
        return (
          <div className="space-y-3">
            {ficheTechnique.aromes?.dominantes && (
              <div className="bg-amber-50 p-3 rounded-lg">
                <h5 className="font-bold text-primary text-sm mb-1">🌿 Notes dominantes</h5>
                <p className="text-sm text-muted-foreground">{ficheTechnique.aromes.dominantes}</p>
              </div>
            )}

            {isPremium ? (
              <>
                {ficheTechnique.aromes?.secondaires && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <h5 className="font-bold text-primary text-sm mb-1">🍂 Nuances secondaires</h5>
                    <p className="text-sm text-muted-foreground">{ficheTechnique.aromes.secondaires}</p>
                  </div>
                )}
                {ficheTechnique.aromes?.evolution && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <h5 className="font-bold text-primary text-sm mb-1">📈 Évolution</h5>
                    <p className="text-sm text-muted-foreground">{ficheTechnique.aromes.evolution}</p>
                  </div>
                )}
              </>
            ) : (
              <MembershipTeaser 
                title="Palette aromatique complète"
                features={["12+ nuances secondaires", "Évolution tiers par tiers", "Accords recommandés"]}
              />
            )}
          </div>
        );

      case 'degustation':
        return (
          <div className="space-y-4">
            {ficheTechnique.positionnement && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700 leading-relaxed">{ficheTechnique.positionnement}</p>
              </div>
            )}

            {isPremium ? (
              <>
                {ficheTechnique.impressions && (
                  <div className="pt-4 border-t border-gray-200">
                    <h5 className="font-bold text-purple-800 text-sm mb-2 flex items-center gap-2">
                      🍷 Impressions de dégustation
                    </h5>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{ficheTechnique.impressions}</p>
                    </div>
                  </div>
                )}
                
                {(ficheTechnique.accords || ficheTechnique.degustation?.accords) && (
                  <div className="pt-4 border-t border-gray-200">
                    <h5 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                      🥃 Accords recommandés
                    </h5>
                    <div className="bg-amber-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-700 leading-relaxed">{ficheTechnique.accords || ficheTechnique.degustation?.accords}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <MembershipTeaser 
                title="Impressions de dégustation complètes"
                features={["Analyse détaillée du profil", "Évolution tiers par tiers", "Accords recommandés (whisky, café, chocolat)"]}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background text-foreground border-none shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
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

            {!isBundle && (
              <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
                {product.badges?.coty && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                    <span>🏆 {t("product.cigarOfYear")} ({product.badges.top25Year})</span>
                  </div>
                )}

                {product.badges?.top25 && !product.badges?.coty && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>
                      {product.badges.top25Rang === 1
                        ? `${t("product.cigarOfYear")}, ${product.badges.top25Year}`
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

          <div className="p-6 md:p-8 flex flex-col h-full">
            <div className="mb-6">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-xl font-serif font-bold text-primary mb-1 leading-tight flex items-center gap-2">
                    <span>
                      {product.marque}
                      {product.ligne && `, ${product.ligne}`}
                    </span>
                    {isPremium && <span className="text-yellow-500 text-lg">🌟</span>}
                    {!isBundle && (product.origine || product.pays) && (
                      <span className="text-sm text-muted-foreground font-sans font-normal ml-2">
                        · {t(`countries.${product.origine || product.pays}`, { defaultValue: product.origine || product.pays })}
                      </span>
                    )}
                  </h3>

                  {!isBundle && (product.vitole || product.format || displayDimensions) && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {product.vitole && product.vitole !== product.format
                        ? `${product.vitole}, ${product.format}`
                        : product.format}
                      {displayDimensions && ` - ${displayDimensions}`}
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
                        {getPuissanceLabel(product.puissance, t)}
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
                  {isBundle ? t(`bundles.${product.sku}`, { defaultValue: product.description }) : product.description}
                </p>
              )}
            </div>

            {isBundle ? (
              <div className="flex-1 mb-8">
                {product.composition && product.composition.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-bold text-primary text-sm flex items-center gap-2">
                      <span>📦</span> {t("product.bundleComposition")}
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
                                  {t("product.caRating")} : {ratingNum}
                                </span>
                              )}
                              {ratingNum && (isCoty || top25Rank) && (
                                <span className="mx-1">·</span>
                              )}
                              {isCoty && cotyYear && (
                                <span className="text-amber-600 font-bold">
                                  {t("product.cigarOfYear")}, {cotyYear}
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
              <div className="flex-1 mb-8">
                <div className={`grid w-full gap-1 mb-4 ${isPremium ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "py-2 px-2 rounded-md text-xs font-medium transition-all",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-[180px]">
                  {renderTabContent()}
                </div>
              </div>
            )}

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
                                ? t("product.unit")
                                : fmt === "pack"
                                ? t("product.pack")
                                : t("product.box")}
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
                    {t("product.totalPrice")}
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
                  className="flex-1 gap-2 bg-[#B87333] hover:bg-[#9A5F2A] text-white"
                >
                  <ShoppingCart size={18} /> {t("product.add")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsPremium(!isPremium)}
          className="fixed bottom-4 right-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
        >
          {isPremium ? '🌟 Mode Premium' : '🔓 Mode Gratuit'}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetail;
