import React, { useState } from "react";
import { useProducts } from "@/context/ProductContext";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function GestionAssociations() {
  const productsContext = useProducts() || {};
  const {
    products = [],
    removeProduitImages = () => {
      console.warn("removeProduitImages appelé sans ProductProvider");
    },
  } = productsContext;

  const [filtre, setFiltre] = useState("avec");

  const produitsFiltres = products.filter((p) => {
    const hasAnyImage =
      p.imagePrincipale ||
      p.imageSolo ||
      p.imagePack4 ||
      p.imagePack5 ||
      p.imagePack ||
      p.imageBoite;

    if (filtre === "avec") return !!hasAnyImage;
    if (filtre === "sans") return !hasAnyImage;
    return true;
  });

  const handleSupprimerImage = (sku, type) => {
    if (confirm(`Supprimer l'image ${type} ?`)) {
      removeProduitImages(sku, type);
      toast.success(`Image ${type} supprimée`);
    }
  };

  const handleSupprimerTout = (sku, marque) => {
    if (confirm(`Supprimer TOUTES les images de ${marque} ?`)) {
      removeProduitImages(sku, "all");
      toast.success("Toutes les images supprimées");
    }
  };

  const countAvec = products.filter(
    (p) =>
      p.imagePrincipale ||
      p.imageSolo ||
      p.imagePack4 ||
      p.imagePack5 ||
      p.imagePack ||
      p.imageBoite,
  ).length;
  const countSans = products.filter(
    (p) =>
      !p.imagePrincipale &&
      !p.imageSolo &&
      !p.imagePack4 &&
      !p.imagePack5 &&
      !p.imagePack &&
      !p.imageBoite,
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-serif font-bold text-primary">
          Gestion des Associations
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => setFiltre("avec")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filtre === "avec"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Avec images ({countAvec})
          </button>
          <button
            onClick={() => setFiltre("sans")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filtre === "sans"
                ? "bg-orange-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Sans images ({countSans})
          </button>
          <button
            onClick={() => setFiltre("tous")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filtre === "tous"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Tous ({products.length})
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
          📝 Procédure : Pack (4) vs Pack (5)
        </h3>
        <div className="text-sm text-yellow-800 space-y-2">
          <p className="font-semibold">
            Attribution automatique basée sur le ring gauge :
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>
              <strong>Ring ≤ 55</strong> → Diamètre fin →{" "}
              <strong>Pack (5)</strong>
            </li>
            <li>
              <strong>Ring &gt; 55</strong> → Diamètre gros →{" "}
              <strong>Pack (4)</strong>
            </li>
          </ul>
          <div className="mt-3 pt-3 border-t border-yellow-200">
            <p className="font-semibold mb-1">
              ✅ Vérification manuelle requise :
            </p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>
                Vérifiez que l'image affichée correspond au nombre de cigares
              </li>
              <li>
                Si incorrect (ex: 5 cigares pour un Pack 4) :
                <ul className="list-disc list-inside ml-6 mt-1">
                  <li>Cliquez sur "Supprimer" pour cette image</li>
                  <li>
                    Re-uploadez la bonne image avec le bon type (pack4 ou pack5)
                  </li>
                </ul>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {produitsFiltres.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
            <ImageIcon size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Aucun produit dans cette catégorie</p>
          </div>
        ) : (
          produitsFiltres.map((produit) => (
            <div
              key={produit.sku}
              className="bg-white rounded-lg shadow border p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {produit.marque}
                    {produit.ligne ? `, ${produit.ligne}` : ""} -{" "}
                    {produit.vitole && produit.vitole !== produit.format
                      ? `${produit.vitole}, `
                      : ""}
                    {produit.format || produit.vitole}
                    {produit.longueur && produit.diametre
                      ? ` (${produit.longueur} × ${produit.diametre})`
                      : ""}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono">
                    {produit.sku}
                  </p>
                  {produit.diametre && (
                    <p className="text-xs text-gray-400 mt-1">
                      Ring gauge: {produit.diametre} → Pack recommandé:{" "}
                      {parseInt(produit.diametre) <= 55 ? "(5)" : "(4)"}
                    </p>
                  )}
                </div>

                {(produit.imagePrincipale ||
                  produit.imageSolo ||
                  produit.imagePack4 ||
                  produit.imagePack5 ||
                  produit.imagePack ||
                  produit.imageBoite) && (
                  <button
                    onClick={() =>
                      handleSupprimerTout(produit.sku, produit.marque)
                    }
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-2 font-medium"
                  >
                    <Trash2 size={16} />
                    Tout supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["principale", "solo", "pack", "boite"].map((type) => {
                  let image = null;

                  if (type === "principale") {
                    image = produit.imagePrincipale;
                  } else if (type === "solo") {
                    image = produit.imageSolo;
                  } else if (type === "pack") {
                    const ring = parseInt(produit.diametre) || 50;
                    if (ring <= 55) {
                      image =
                        produit.imagePack5 ||
                        produit.imagePack4 ||
                        produit.imagePack;
                    } else {
                      image =
                        produit.imagePack4 ||
                        produit.imagePack5 ||
                        produit.imagePack;
                    }
                  } else if (type === "boite") {
                    image = produit.imageBoite;
                  }

                  return (
                    <div
                      key={type}
                      className="border rounded-lg overflow-hidden"
                    >
                      <div className="bg-gray-100 p-2 text-xs font-bold text-gray-700 capitalize flex justify-between items-center">
                        <span>
                          {type === "principale"
                            ? "Principale (Défaut)"
                            : type === "solo"
                              ? "Solo (Cigare)"
                              : type === "pack"
                                ? "Pack"
                                : "Boîte"}
                        </span>
                        {image && (
                          <button
                            onClick={() =>
                              handleSupprimerImage(produit.sku, type)
                            }
                            className="text-red-600 hover:text-red-800"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        {image ? (
                          <img
                            src={image}
                            alt={`${produit.marque} ${type}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-gray-300 text-xs">
                            Aucune image
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
