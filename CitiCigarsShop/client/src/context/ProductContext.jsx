import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import apiService from "../services/apiService";

const ProductContext = createContext();

export const useProducts = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        // First, try to seed the database (will skip if already seeded)
        await apiService.seedDatabase();
        console.log("✅ Database seeded or already populated");

        // Then fetch all products
        const loadedProducts = await apiService.getAllProducts();
        setProducts(loadedProducts);
        setDbInitialized(true);
        setLoading(false);
        console.log(`✅ Loaded ${loadedProducts.length} products from server`);
      } catch (error) {
        console.error("❌ Error initializing data:", error);
        toast.error("Erreur lors du chargement des données");
        setLoading(false);
      }
    };

    initData();
  }, []);

  const updateProduct = async (sku, updates) => {
    try {
      await apiService.updateProduct(sku, updates);
      const loadedProducts = await apiService.getAllProducts();
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
      const result = await apiService.uploadImages(sku, imagesData);
      console.log("uploadImages result →", result);
      
      const loadedProducts = await apiService.getAllProducts();
      setProducts(loadedProducts);
      return { success: true, sku };
    } catch (error) {
      console.error("Error updating images:", error);
      toast.error(`Erreur upload images pour ${sku}: ${error.message}`);
      return { success: false, sku, error: error.message };
    }
  };

  const removeProduitImages = async (sku, type) => {
    try {
      if (!type || type.toLowerCase() === "all") {
        await apiService.deleteImages(sku);
      } else {
        await apiService.deleteImageByType(sku, type);
      }

      const loadedProducts = await apiService.getAllProducts();
      setProducts(loadedProducts);
      toast.success("Images supprimées");
    } catch (error) {
      console.error("Error removing image(s):", error);
      toast.error("Erreur lors de la suppression des images");
    }
  };

  const deleteProduct = async (sku) => {
    try {
      await apiService.deleteProduct(sku);
      const loadedProducts = await apiService.getAllProducts();
      setProducts(loadedProducts);
      toast.success("Produit supprimé");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const importProducts = async (productsToImport) => {
    try {
      setLoading(true);
      const result = await apiService.importProducts(productsToImport);
      const loadedProducts = await apiService.getAllProducts();
      setProducts(loadedProducts);
      setLoading(false);
      return result;
    } catch (error) {
      console.error("Error importing products:", error);
      toast.error("Erreur lors de l'import des produits");
      setLoading(false);
      throw error;
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
    importProducts,
    refreshProducts: async () => {
      const loadedProducts = await apiService.getAllProducts();
      setProducts(loadedProducts);
    },
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};
