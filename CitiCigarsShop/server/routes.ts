import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bundleStorage } from "./storage.bundles";
import { catalogueData } from "../client/src/data/catalogueData";
import { bundlesData } from "../client/src/data/bundles";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { parseTechnicalSheetTXT } from "./services/technical-sheet-parser";
import { registerCrmRoutes } from "./routes.crm";

const ROOT_DIR = process.cwd();
const CONTENT_FILE = path.resolve(ROOT_DIR, "server", "content.json");
import { getAdminPassword, isValidAdminToken, requireAdminAuth } from "./middleware/auth";
// No hardcoded fallback: middleware/auth.ts throws at startup if
// CMS_ADMIN_PASSWORD is not set. See brief correction #5/#7.
const ADMIN_PASSWORD = getAdminPassword();
const CMS_ASSETS_DIR = path.resolve(ROOT_DIR, "client/public/cms-assets");

if (!fs.existsSync(CMS_ASSETS_DIR)) {
  fs.mkdirSync(CMS_ASSETS_DIR, { recursive: true });
}

const cmsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CMS_ASSETS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use('/cms-assets', express.static(CMS_ASSETS_DIR, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
  
  app.get("/api/products", async (req, res) => {
    try {
      const includeImages = req.query.includeImages === 'true';
      const products = await storage.getAllProducts();
      
      if (includeImages) {
        const productsWithImages = await Promise.all(
          products.map(async (product) => {
            const images = await storage.getImagesBySku(product.sku);
            return mapProductWithImages(product, images);
          })
        );
        res.json(productsWithImages);
      } else {
        const parsedProducts = products.map(product => {
          let promotions = product.promotions;
          let badges = product.badges;
          let composition = product.composition;
          let ficheTechnique = product.ficheTechnique;
          
          if (typeof promotions === 'string') {
            try { promotions = JSON.parse(promotions); } catch (e) { promotions = null; }
          }
          if (typeof badges === 'string') {
            try { badges = JSON.parse(badges); } catch (e) { badges = null; }
          }
          if (typeof composition === 'string') {
            try { composition = JSON.parse(composition); } catch (e) { composition = null; }
          }
          if (typeof ficheTechnique === 'string') {
            try { ficheTechnique = JSON.parse(ficheTechnique); } catch (e) { ficheTechnique = null; }
          }
          
          return { ...product, promotions, badges, composition, ficheTechnique };
        });
        res.json(parsedProducts);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/filters/vitoles", async (req, res) => {
    try {
      const vitoles = await storage.getDistinctVitoles();
      res.json(vitoles);
    } catch (error) {
      console.error("Error fetching vitoles:", error);
      res.status(500).json({ error: "Failed to fetch vitoles" });
    }
  });

  app.get("/api/filters/pays", async (req, res) => {
    try {
      const pays = await storage.getDistinctPays();
      res.json(pays);
    } catch (error) {
      console.error("Error fetching pays:", error);
      res.status(500).json({ error: "Failed to fetch pays" });
    }
  });

  app.get("/api/filters/formats", async (req, res) => {
    try {
      const formats = await storage.getDistinctFormats();
      res.json(formats);
    } catch (error) {
      console.error("Error fetching formats:", error);
      res.status(500).json({ error: "Failed to fetch formats" });
    }
  });

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

  app.post("/api/products", async (req, res) => {
    try {
      const product = req.body;
      if (!product.sku || !product.marque) {
        return res.status(400).json({ error: "SKU et marque sont requis" });
      }
      
      const existing = await storage.getProduct(product.sku);
      if (existing) {
        return res.status(409).json({ error: "Un produit avec ce SKU existe déjà" });
      }
      
      const created = await storage.createProduct(product);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

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

  app.delete("/api/products/:sku", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.sku);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.post("/api/products/bulk-update-prices", async (req, res) => {
    try {
      const { updates } = req.body;
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates array required" });
      }
      const results = { updated: 0, notFound: [] as string[], errors: [] as string[] };
      for (const update of updates) {
        try {
          const { sku, prixUnitaire, prixPack, prixBoite, promotions } = update;
          if (!sku) { results.errors.push("SKU manquant"); continue; }
          const existing = await storage.getProduct(sku);
          if (!existing) { results.notFound.push(sku); continue; }
          const updateData: any = {};
          if (prixUnitaire !== undefined && prixUnitaire !== null) updateData.prixUnitaire = prixUnitaire;
          if (prixPack !== undefined && prixPack !== null) updateData.prixPack = prixPack;
          if (prixBoite !== undefined && prixBoite !== null) updateData.prixBoite = prixBoite;
          if (promotions !== undefined) updateData.promotions = promotions;
          await storage.updateProduct(sku, updateData);
          results.updated++;
        } catch (err) { results.errors.push(`Erreur pour ${update.sku}: ${err}`); }
      }
      res.json({ success: true, message: `${results.updated} produits mis à jour`, ...results });
    } catch (error) {
      console.error("Error bulk updating prices:", error);
      res.status(500).json({ error: "Failed to bulk update prices" });
    }
  });

  app.post("/api/products/bulk-update-puissance", async (req, res) => {
    try {
      const { updates } = req.body;
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates array required" });
      }
      const results = { updated: 0, notFound: [] as string[], errors: [] as string[] };
      for (const update of updates) {
        try {
          const { sku, puissance } = update;
          if (!sku) { results.errors.push("SKU manquant"); continue; }
          if (puissance === undefined || puissance === null || puissance < 1 || puissance > 5) {
            results.errors.push(`Puissance invalide pour ${sku}`); continue;
          }
          const existing = await storage.getProduct(sku);
          if (!existing) { results.notFound.push(sku); continue; }
          await storage.updateProduct(sku, { puissance });
          results.updated++;
        } catch (err) { results.errors.push(`Erreur pour ${update.sku}: ${err}`); }
      }
      res.json({ success: true, message: `${results.updated} produits mis à jour`, ...results });
    } catch (error) {
      console.error("Error bulk updating puissance:", error);
      res.status(500).json({ error: "Failed to bulk update puissance" });
    }
  });

  app.post("/api/products/import", async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Products array required" });
      }
      const results = { created: 0, updated: 0, errors: [] as string[] };
      for (const product of products) {
        try {
          if (!product.sku) { results.errors.push("Produit sans SKU ignoré"); continue; }
          const existing = await storage.getProduct(product.sku);
          if (existing) {
            await storage.updateProduct(product.sku, product);
            results.updated++;
          } else {
            await storage.createProduct(product);
            results.created++;
          }
        } catch (err) { results.errors.push(`Erreur pour ${product.sku}: ${err}`); }
      }
      res.json({ success: true, message: `${results.created} créés, ${results.updated} mis à jour`, ...results });
    } catch (error) {
      console.error("Error importing products:", error);
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  app.post("/api/products/:sku/images", async (req, res) => {
    try {
      const { sku } = req.params;
      const { images } = req.body;
      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ error: "Images array required" });
      }
      await storage.deleteImagesBySku(sku);
      for (const img of images) {
        await storage.addImage({ sku, type: img.type, data: img.data });
      }
      res.json({ success: true, count: images.length });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  app.delete("/api/products/:sku/images", async (req, res) => {
    try {
      await storage.deleteImagesBySku(req.params.sku);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting images:", error);
      res.status(500).json({ error: "Failed to delete images" });
    }
  });

  app.delete("/api/products/:sku/images/:type", async (req, res) => {
    try {
      await storage.deleteImageByType(req.params.sku, req.params.type);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      const existingProducts = await storage.getAllProducts();
      if (existingProducts.length > 0) {
        return res.json({ message: "Database already seeded", count: existingProducts.length });
      }
      for (const p of catalogueData) {
        await storage.createProduct({
          sku: p.sku, marque: p.marque, ligne: p.ligne || null, pays: p.pays || null,
          modele: p.modele || null, vitole: p.vitole || null, format: p.format || null,
          dimensions: p.dimensions || null, qteBoite: p.qteBoite || null, typePack: p.typePack || null,
          puissance: p.puissance || null, rating: p.rating?.toString() || null, top25: p.top25 || false,
          rank: p.rank || null, year: p.year || null, prixUnitaire: p.prixUnitaire || null,
          prixBoite: p.prixBoite || null, prixPack: p.prixPack || null, inCatalogue: p.inCatalogue !== false,
          type: "standard",
          promotions: { unitaire: { actif: false, pourcentage: 0 }, pack: { actif: false, pourcentage: 0 }, boite: { actif: false, pourcentage: 0 } },
          badges: { coty: p.rank === 1, top25: p.top25, top25Year: p.year, top25Rang: p.rank, rating: p.rating },
        });
      }
      for (const bundle of bundlesData) {
        await storage.createProduct({
          sku: bundle.sku, marque: bundle.marque, modele: bundle.modele || null,
          description: bundle.description || null, prixBundle: bundle.prixBundle || bundle.prixUnitaire || null,
          prixUnitaire: bundle.prixUnitaire || null, type: "bundle", composition: bundle.composition || null, inCatalogue: true,
        });
      }
      res.json({ message: "Database seeded successfully", products: catalogueData.length, bundles: bundlesData.length });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  function readContent() {
    try {
      if (fs.existsSync(CONTENT_FILE)) {
        return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));
      }
    } catch (err) { console.error("Error reading content file:", err); }
    return null;
  }

  function writeContent(content: any) {
    content._meta = { lastUpdated: new Date().toISOString(), updatedBy: "admin" };
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2), "utf-8");
  }

  function sanitizeString(str: string, maxLength = 1000): string {
    if (typeof str !== "string") return "";
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<[^>]*on\w+\s*=/gi, "<").slice(0, maxLength);
  }

  function sanitizeContent(obj: any): any {
    if (typeof obj === "string") return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeContent);
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const key of Object.keys(obj)) { if (key !== "_meta") result[key] = sanitizeContent(obj[key]); }
      return result;
    }
    return obj;
  }

  app.get("/api/content", (req, res) => {
    const content = readContent();
    if (!content) return res.status(500).json({ error: "Content not available" });
    res.json(content);
  });

  app.post("/api/content/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString("base64") });
    } else {
      res.status(401).json({ error: "Mot de passe incorrect" });
    }
  });

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

  function checkCmsAuth(req: any): boolean {
    const authHeader = req.headers.authorization;
    const cmsToken = req.headers['x-cms-token'];
    const token = cmsToken || authHeader?.replace("Bearer ", "");
    return isValidAdminToken(token);
  }

  app.get("/api/cms/assets", (req, res) => {
    try {
      const files = fs.readdirSync(CMS_ASSETS_DIR);
      const assets = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f)).map(filename => {
        const stats = fs.statSync(path.join(CMS_ASSETS_DIR, filename));
        return { filename, url: `/cms-assets/${filename}`, size: stats.size, uploadedAt: stats.mtime.toISOString() };
      }).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      res.json(assets);
    } catch (error) {
      console.error("Error listing CMS assets:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des images" });
    }
  });

  app.post("/api/cms/assets", cmsUpload.single("image"), (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    if (!req.file) return res.status(400).json({ error: "Aucun fichier fourni" });
    res.json({ success: true, filename: req.file.filename, url: `/cms-assets/${req.file.filename}`, size: req.file.size });
  });

  app.delete("/api/cms/assets/:filename", (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    const safeFilename = path.basename(req.params.filename);
    const filepath = path.join(CMS_ASSETS_DIR, safeFilename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Fichier non trouvé" });
    try {
      fs.unlinkSync(filepath);
      res.json({ success: true, message: "Image supprimée" });
    } catch (error) {
      console.error("Error deleting CMS asset:", error);
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  });

  app.get("/api/admin/products/skus", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      const productList = products.map(p => ({ sku: p.sku, marque: p.marque, ligne: p.ligne, modele: p.modele })).sort((a, b) => a.sku.localeCompare(b.sku));
      res.json(productList);
    } catch (error) {
      console.error("Error fetching product SKUs:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/admin/technical-sheets/import", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { sku, fileContent, isPremium } = req.body;
      if (!sku || !fileContent) return res.status(400).json({ error: "SKU et contenu requis" });
      const parsed = parseTechnicalSheetTXT(fileContent);
      await storage.upsertTechnicalSheet({ sku, ...parsed, isPremium: isPremium || false });
      res.json({ success: true, sku, parsed });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import technical sheet" });
    }
  });

  app.get("/api/products/:sku/technical-sheet", async (req, res) => {
    try {
      const sheet = await storage.getTechnicalSheet(req.params.sku);
      if (!sheet) return res.status(404).json({ error: "Technical sheet not found" });
      res.json(sheet);
    } catch (error) {
      console.error("Error fetching technical sheet:", error);
      res.status(500).json({ error: "Failed to fetch technical sheet" });
    }
  });

  app.get("/api/admin/technical-sheets", async (req, res) => {
    try {
      const sheets = await storage.getAllTechnicalSheets();
      res.json(sheets);
    } catch (error) {
      console.error("Error fetching technical sheets:", error);
      res.status(500).json({ error: "Failed to fetch technical sheets" });
    }
  });

  app.delete("/api/admin/technical-sheets/:sku", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      await storage.deleteTechnicalSheet(req.params.sku);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting technical sheet:", error);
      res.status(500).json({ error: "Failed to delete technical sheet" });
    }
  });

  // === BUNDLES API ===

  app.get("/api/bundles", async (req, res) => {
    try {
      const bundles = await bundleStorage.getAllBundles();
      res.json(bundles);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  app.get("/api/bundles/:sku", async (req, res) => {
    try {
      const bundle = await bundleStorage.getBundleWithProducts(req.params.sku);
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (error) {
      console.error("Error fetching bundle:", error);
      res.status(500).json({ error: "Failed to fetch bundle" });
    }
  });

  app.post("/api/bundles", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { bundleData, items } = req.body;
      if (!bundleData?.sku || !bundleData?.nom) return res.status(400).json({ error: "SKU et nom sont requis" });
      const bundle = await bundleStorage.createBundle(bundleData, items || []);
      res.status(201).json(bundle);
    } catch (error) {
      console.error("Error creating bundle:", error);
      res.status(500).json({ error: "Failed to create bundle" });
    }
  });

  app.put("/api/bundles/:sku", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { bundleData, items } = req.body;
      const bundle = await bundleStorage.updateBundle(req.params.sku, bundleData || {}, items);
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (error) {
      console.error("Error updating bundle:", error);
      res.status(500).json({ error: "Failed to update bundle" });
    }
  });

  app.put("/api/bundles/:sku/availability", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { availabilityStatus, soldOutAt } = req.body;
      const bundle = await bundleStorage.updateBundleAvailability(req.params.sku, availabilityStatus, soldOutAt ? new Date(soldOutAt) : undefined);
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (error) {
      console.error("Error updating bundle availability:", error);
      res.status(500).json({ error: "Failed to update bundle availability" });
    }
  });

  app.delete("/api/bundles/:sku", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const deleted = await bundleStorage.deleteBundle(req.params.sku);
      if (!deleted) return res.status(404).json({ error: "Bundle not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bundle:", error);
      res.status(500).json({ error: "Failed to delete bundle" });
    }
  });

  app.get("/api/admin/bundles/products", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const products = await bundleStorage.getProductsForSelection();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products for bundle:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/admin/bundles/calculate-price", async (req, res) => {
    if (!checkCmsAuth(req)) return res.status(401).json({ error: "Non autorisé" });
    try {
      const { items } = req.body;
      const suggestedPrice = await bundleStorage.calculateSuggestedPrice(items || []);
      res.json({ suggestedPrice });
    } catch (error) {
      console.error("Error calculating price:", error);
      res.status(500).json({ error: "Failed to calculate price" });
    }
  });

  registerCrmRoutes(app);

  return httpServer;
}

function mapProductWithImages(product: any, images: any[]) {
  const normalizeType = (type: string) => (type || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const imageMap: any = { imagePrincipale: null, imageSolo: null, imagePack: null, imagePack4: null, imagePack5: null, imageBoite: null };
  images.forEach((img) => {
    const t = normalizeType(img.type);
    const imgSrc = img.url || img.data;
    if (t.includes('principale') || t.includes('open') || t.includes('defaut')) imageMap.imagePrincipale = imgSrc;
    else if (t.includes('solo') || t.includes('cigare')) imageMap.imageSolo = imgSrc;
    else if (t === 'pack4' || t.includes('pack_4') || t.includes('pack (4)')) { imageMap.imagePack4 = imgSrc; if (!imageMap.imagePack) imageMap.imagePack = imgSrc; }
    else if (t === 'pack5' || t.includes('pack_5') || t.includes('pack (5)')) { imageMap.imagePack5 = imgSrc; if (!imageMap.imagePack) imageMap.imagePack = imgSrc; }
    else if (t.includes('pack')) imageMap.imagePack = imgSrc;
    else if (t.includes('boite') || t.includes('closed')) imageMap.imageBoite = imgSrc;
  });
  let promotions = product.promotions, badges = product.badges, composition = product.composition, ficheTechnique = product.ficheTechnique;
  if (typeof promotions === 'string') try { promotions = JSON.parse(promotions); } catch (e) { promotions = null; }
  if (typeof badges === 'string') try { badges = JSON.parse(badges); } catch (e) { badges = null; }
  if (typeof composition === 'string') try { composition = JSON.parse(composition); } catch (e) { composition = null; }
  if (typeof ficheTechnique === 'string') try { ficheTechnique = JSON.parse(ficheTechnique); } catch (e) { ficheTechnique = null; }
  return { ...product, ...imageMap, promotions, badges, composition, ficheTechnique, images: images.map(img => ({ ...img, data: img.url || img.data })) };
}

function mapImagesToFields(images: any[]) {
  const normalizeType = (type: string) => (type || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const imageMap: any = { imagePrincipale: null, imageSolo: null, imagePack: null, imagePack4: null, imagePack5: null, imageBoite: null };
  images.forEach((img) => {
    const t = normalizeType(img.type);
    const imgSrc = img.url || img.data;
    if (t.includes('principale') || t.includes('open') || t.includes('defaut')) imageMap.imagePrincipale = imgSrc;
    else if (t.includes('solo') || t.includes('cigare')) imageMap.imageSolo = imgSrc;
    else if (t === 'pack4' || t.includes('pack_4') || t.includes('pack (4)')) { imageMap.imagePack4 = imgSrc; if (!imageMap.imagePack) imageMap.imagePack = imgSrc; }
    else if (t === 'pack5' || t.includes('pack_5') || t.includes('pack (5)')) { imageMap.imagePack5 = imgSrc; if (!imageMap.imagePack) imageMap.imagePack = imgSrc; }
    else if (t.includes('pack')) imageMap.imagePack = imgSrc;
    else if (t.includes('boite') || t.includes('closed')) imageMap.imageBoite = imgSrc;
  });
  return imageMap;
}
