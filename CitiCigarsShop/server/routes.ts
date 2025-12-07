import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { catalogueData } from "../client/src/data/catalogueData";
import { bundlesData } from "../client/src/data/bundles";
import * as fs from "fs";
import * as path from "path";

const CONTENT_FILE = path.join(__dirname, "content.json");
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || "citicigars2024";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === PRODUCTS API ===
  
  // Get all products (lightweight - no image data by default)
  app.get("/api/products", async (req, res) => {
    try {
      const includeImages = req.query.includeImages === 'true';
      const products = await storage.getAllProducts();
      
      if (includeImages) {
        // Full load with images (slower)
        const productsWithImages = await Promise.all(
          products.map(async (product) => {
            const images = await storage.getImagesBySku(product.sku);
            return mapProductWithImages(product, images);
          })
        );
        res.json(productsWithImages);
      } else {
        // Lightweight load - just product data, no images
        res.json(products);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get images for a specific product (called on demand)
  app.get("/api/products/:sku/images", async (req, res) => {
    try {
      const images = await storage.getImagesBySku(req.params.sku);
      const imageMap = mapImagesToFields(images);
      res.json(imageMap);
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
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

  // Bulk update puissance
  app.post("/api/products/bulk-update-puissance", async (req, res) => {
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
          const { sku, puissance } = update;
          
          if (!sku) {
            results.errors.push("SKU manquant");
            continue;
          }

          if (puissance === undefined || puissance === null || puissance < 1 || puissance > 5) {
            results.errors.push(`Puissance invalide pour ${sku}`);
            continue;
          }

          const existing = await storage.getProduct(sku);
          if (!existing) {
            results.notFound.push(sku);
            continue;
          }

          await storage.updateProduct(sku, { puissance });
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
      console.error("Error bulk updating puissance:", error);
      res.status(500).json({ error: "Failed to bulk update puissance" });
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

  // === CMS CONTENT API ===

  // Helper: Read content file
  function readContent() {
    try {
      if (fs.existsSync(CONTENT_FILE)) {
        const data = fs.readFileSync(CONTENT_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error reading content file:", err);
    }
    return null;
  }

  // Helper: Write content file
  function writeContent(content: any) {
    content._meta = {
      lastUpdated: new Date().toISOString(),
      updatedBy: "admin"
    };
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2), "utf-8");
  }

  // Helper: Sanitize strings (basic XSS prevention + length limits)
  function sanitizeString(str: string, maxLength = 1000): string {
    if (typeof str !== "string") return "";
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]*on\w+\s*=/gi, "<")
      .slice(0, maxLength);
  }

  function sanitizeContent(obj: any): any {
    if (typeof obj === "string") {
      return sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeContent);
    }
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        if (key !== "_meta") {
          result[key] = sanitizeContent(obj[key]);
        }
      }
      return result;
    }
    return obj;
  }

  // GET /api/content - Public: retrieve content
  app.get("/api/content", (req, res) => {
    const content = readContent();
    if (!content) {
      return res.status(500).json({ error: "Content not available" });
    }
    res.json(content);
  });

  // POST /api/content/login - Admin login
  app.post("/api/content/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString("base64") });
    } else {
      res.status(401).json({ error: "Mot de passe incorrect" });
    }
  });

  // PUT /api/content - Admin: update content
  app.put("/api/content", (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token || Buffer.from(token, "base64").toString() !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Non autorisé" });
    }

    try {
      const sanitized = sanitizeContent(req.body);
      writeContent(sanitized);
      res.json({ success: true, content: readContent() });
    } catch (error) {
      console.error("Error updating content:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
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

// Helper to map images to field names (without product data)
function mapImagesToFields(images: any[]) {
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

  return imageMap;
}
