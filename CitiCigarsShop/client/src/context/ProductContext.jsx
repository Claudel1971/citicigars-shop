import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import dbService from "../services/indexedDBService";
import { catalogueData } from "../data/catalogueData";
import { bundlesData } from "../data/bundles";

const ProductContext = createContext();

export const useProducts = () => useContext(ProductContext);

const mapToDbType = (rawType) => {
  const t = (rawType || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (t === "principale" || t.startsWith("open")) return "Principale (Défaut)";
  if (t === "unit" || t === "unitaire" || t === "solo") return "Solo (Cigare)";
  if (t === "pack" || t === "bundle") return "Pack";
  if (t.startsWith("boite") || t.startsWith("boîte") || t.includes("closed"))
    return "Boîte";

  if (t.includes("principale")) return "Principale (Défaut)";
  if (t.includes("solo")) return "Solo (Cigare)";
  if (t === "pack") return "Pack";
  if (t.includes("boite") || t.includes("boîte")) return "Boîte";

  return "Principale (Défaut)";
};

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const initDB = async () => {
      try {
        await dbService.init();
        console.log("✅ IndexedDB initialized");

        const existingProducts = await dbService.getAllProducts();

        if (existingProducts.length === 0) {
          console.log("🔄 Database empty, checking localStorage...");

          const localData = localStorage.getItem("citicigars-products");
          if (localData) {
            await dbService.migrateFromLocalStorage();
            toast.success("Données migrées vers IndexedDB");
          } else {
            console.log("🌱 Seeding database with initial data...");
            const initialProducts = catalogueData.map((p) => ({
              ...p,
              promotions: {
                unitaire: { actif: false, pourcentage: 0 },
                pack: { actif: false, pourcentage: 0 },
                boite: { actif: false, pourcentage: 0 },
              },
              badges: {
                coty: p.rank === 1,
                top25: p.top25,
                top25Year: p.year,
                top25Rang: p.rank,
                rating: p.rating,
              },
              type: "standard",
            }));

            for (const product of initialProducts) {
              await dbService.addProduct(product);
            }

            for (const bundle of bundlesData) {
              await dbService.addProduct({ ...bundle, type: "bundle" });
            }

            console.log(
              `✅ Seeded ${initialProducts.length} products + ${bundlesData.length} bundles`,
            );
          }
        }

        const loadedProducts = await dbService.getAllProductsWithImages();
        setProducts(loadedProducts);
        setDbInitialized(true);
        setLoading(false);
      } catch (error) {
        console.error("❌ Error initializing IndexedDB:", error);
        toast.error("Erreur lors de l'initialisation de la base de données");
        setLoading(false);
      }
    };

    initDB();
  }, []);

  const updateProduct = async (sku, updates) => {
    try {
      const product = await dbService.getProduct(sku);
      if (!product) throw new Error("Product not found");

      const updated = { ...product, ...updates };
      await dbService.updateProduct(updated);

      const loadedProducts = await dbService.getAllProductsWithImages();
      setProducts(loadedProducts);

      toast.success("Produit mis à jour");
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const updateProductImages = async (sku, imagesData) => {
    try {
      console.log("updateProductImages →", sku, imagesData);

      await dbService.deleteImagesBySku(sku);

      if (Array.isArray(imagesData) && imagesData.length > 0) {
        for (const imageObj of imagesData) {
          await dbService.addImage({
            sku: sku,
            type: imageObj.type,
            data: imageObj.data,
          });
          console.log(`✅ Image sauvegardée pour ${sku}: ${imageObj.type}`);
        }
      }

      const loadedProducts = await dbService.getAllProductsWithImages();
      setProducts(loadedProducts);
      toast.success(`Images mises à jour pour ${sku}`);
    } catch (error) {
      console.error("Error updating images:", error);
      toast.error("Erreur lors de la mise à jour des images");
    }
  };

  const removeProduitImages = async (sku, type) => {
    try {
      const normalizeType = (t) =>
        (t || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const images = await dbService.getImagesBySku(sku);
      if (!images || images.length === 0) {
        console.warn("Aucune image trouvée pour", sku);
        return;
      }

      if (!type || normalizeType(type) === "all") {
        await dbService.deleteImagesBySku(sku);
      } else {
        const targetType = normalizeType(type);
        const toKeep = images.filter(
          (img) => normalizeType(img.type) !== targetType,
        );

        await dbService.deleteImagesBySku(sku);

        for (const img of toKeep) {
          const { id, ...rest } = img;
          await dbService.addImage(rest);
        }
      }

      const loadedProducts = await dbService.getAllProductsWithImages();
      setProducts(loadedProducts);
      toast.success("Images supprimées");
    } catch (error) {
      console.error("Error removing image(s):", error);
      toast.error("Erreur lors de la suppression des images");
    }
  };

  const deleteProduct = async (sku) => {
    try {
      await dbService.deleteImagesBySku(sku);
      await dbService.deleteProduct(sku);

      const loadedProducts = await dbService.getAllProductsWithImages();
      setProducts(loadedProducts);

      toast.success("Produit supprimé");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const value = {
    products,
    loading,
    dbInitialized,
    updateProduct,
    updateProductImages,
    removeProduitImages,
    deleteProduct,
    refreshProducts: async () => {
      const loadedProducts = await dbService.getAllProductsWithImages();
      setProducts(loadedProducts);
    },
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};
