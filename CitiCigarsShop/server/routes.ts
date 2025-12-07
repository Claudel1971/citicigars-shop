import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { catalogueData } from "../client/src/data/catalogueData";
import { bundlesData } from "../client/src/data/bundles";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === PRODUCTS API ===
  
  // Get all products with their images
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      
      // Get images for each product
      const productsWithImages = await Promise.all(
        products.map(async (product) => {
          const images = await storage.getImagesBySku(product.sku);
          return mapProductWithImages(product, images);
        })
      );
      
      res.json(productsWithImages);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get single product
  app.get("/api/products/:sku", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.sku);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const images = await storage.getImagesBySku(product.sku);
      res.json(mapProductWithImages(product, images));
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Update product
  app.put("/api/products/:sku", async (req, res) => {
    try {
      const updated = await storage.updateProduct(req.params.sku, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Delete product
  app.delete("/api/products/:sku", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.sku);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Bulk update prices
  app.post("/api/products/bulk-update-prices", async (req, res) => {
    try {
      const { updates } = req.body;
      
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates array required" });
      }

      const results = {
        updated: 0,
        notFound: [] as string[],
        errors: [] as string[],
      };

      for (const update of updates) {
        try {
          const { sku, prixUnitaire, prixPack, prixBoite, promotions } = update;
          
          if (!sku) {
            results.errors.push("SKU manquant");
            continue;
          }

          const existing = await storage.getProduct(sku);
          if (!existing) {
            results.notFound.push(sku);
            continue;
          }

          const updateData: any = {};
          
          if (prixUnitaire !== undefined && prixUnitaire !== null) {
            updateData.prixUnitaire = prixUnitaire;
          }
          if (prixPack !== undefined && prixPack !== null) {
            updateData.prixPack = prixPack;
          }
          if (prixBoite !== undefined && prixBoite !== null) {
            updateData.prixBoite = prixBoite;
          }
          if (promotions !== undefined) {
            updateData.promotions = promotions;
          }

          await storage.updateProduct(sku, updateData);
          results.updated++;
        } catch (err) {
          results.errors.push(`Erreur pour ${update.sku}: ${err}`);
        }
      }

      res.json({
        success: true,
        message: `${results.updated} produits mis à jour`,
        ...results,
      });
    } catch (error) {
      console.error("Error bulk updating prices:", error);
      res.status(500).json({ error: "Failed to bulk update prices" });
    }
  });

  // Import products from Excel
  app.post("/api/products/import", async (req, res) => {
    try {
      const { products } = req.body;
      
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Products array required" });
      }

      const results = {
        created: 0,
        updated: 0,
        errors: [] as string[],
      };

      for (const product of products) {
        try {
          if (!product.sku) {
            results.errors.push("Produit sans SKU ignoré");
            continue;
          }

          const existing = await storage.getProduct(product.sku);
          
          if (existing) {
            await storage.updateProduct(product.sku, product);
            results.updated++;
          } else {
            await storage.createProduct(product);
            results.created++;
          }
        } catch (err) {
          results.errors.push(`Erreur pour ${product.sku}: ${err}`);
        }
      }

      res.json({
        success: true,
        message: `${results.created} créés, ${results.updated} mis à jour`,
        ...results,
      });
    } catch (error) {
      console.error("Error importing products:", error);
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  // === IMAGES API ===
  
  // Upload images for a product
  app.post("/api/products/:sku/images", async (req, res) => {
    try {
      const { sku } = req.params;
      const { images } = req.body; // Array of { type, data }
      
      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ error: "Images array required" });
      }

      // Delete existing images for this SKU
      await storage.deleteImagesBySku(sku);
      
      // Add new images
      for (const img of images) {
        await storage.addImage({
          sku,
          type: img.type,
          data: img.data,
        });
      }
      
      res.json({ success: true, count: images.length });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  // Delete all images for a product
  app.delete("/api/products/:sku/images", async (req, res) => {
    try {
      await storage.deleteImagesBySku(req.params.sku);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting images:", error);
      res.status(500).json({ error: "Failed to delete images" });
    }
  });

  // Delete specific image type
  app.delete("/api/products/:sku/images/:type", async (req, res) => {
    try {
      await storage.deleteImageByType(req.params.sku, req.params.type);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // === SEED DATABASE ===
  
  // Seed products from catalogueData if database is empty
  app.post("/api/seed", async (req, res) => {
    try {
      const existingProducts = await storage.getAllProducts();
      
      if (existingProducts.length > 0) {
        return res.json({ 
          message: "Database already seeded", 
          count: existingProducts.length 
        });
      }
      
      // Seed catalogue products
      for (const p of catalogueData) {
        await storage.createProduct({
          sku: p.sku,
          marque: p.marque,
          ligne: p.ligne || null,
          pays: p.pays || null,
          modele: p.modele || null,
          vitole: p.vitole || null,
          format: p.format || null,
          dimensions: p.dimensions || null,
          qteBoite: p.qteBoite || null,
          typePack: p.typePack || null,
          puissance: p.puissance || null,
          rating: p.rating?.toString() || null,
          top25: p.top25 || false,
          rank: p.rank || null,
          year: p.year || null,
          prixUnitaire: p.prixUnitaire || null,
          prixBoite: p.prixBoite || null,
          prixPack: p.prixPack || null,
          inCatalogue: p.inCatalogue !== false,
          type: "standard",
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
        });
      }
      
      // Seed bundles
      for (const bundle of bundlesData) {
        await storage.createProduct({
          sku: bundle.sku,
          marque: bundle.marque,
          modele: bundle.modele || null,
          description: bundle.description || null,
          prixBundle: bundle.prixBundle || bundle.prixUnitaire || null,
          prixUnitaire: bundle.prixUnitaire || null,
          type: "bundle",
          composition: bundle.composition || null,
          inCatalogue: true,
        });
      }
      
      res.json({ 
        message: "Database seeded successfully", 
        products: catalogueData.length,
        bundles: bundlesData.length
      });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  return httpServer;
}

// Helper function to map images to product fields
function mapProductWithImages(product: any, images: any[]) {
  const normalizeType = (type: string) =>
    (type || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const imageMap: any = {
    imagePrincipale: null,
    imageSolo: null,
    imagePack: null,
    imagePack4: null,
    imagePack5: null,
    imageBoite: null,
  };

  images.forEach((img) => {
    const t = normalizeType(img.type);

    if (t.includes('principale') || t.includes('open') || t.includes('defaut')) {
      imageMap.imagePrincipale = img.data;
    } else if (t.includes('solo') || t.includes('cigare')) {
      imageMap.imageSolo = img.data;
    } else if (t === 'pack4' || t.includes('pack_4') || t.includes('pack (4)')) {
      imageMap.imagePack4 = img.data;
      if (!imageMap.imagePack) imageMap.imagePack = img.data;
    } else if (t === 'pack5' || t.includes('pack_5') || t.includes('pack (5)')) {
      imageMap.imagePack5 = img.data;
      if (!imageMap.imagePack) imageMap.imagePack = img.data;
    } else if (t.includes('pack')) {
      imageMap.imagePack = img.data;
    } else if (t.includes('boite') || t.includes('closed')) {
      imageMap.imageBoite = img.data;
    }
  });

  return {
    ...product,
    ...imageMap,
    images,
  };
}
