import { db } from "./db.mysql";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { 
  users, products, productImages, productTechnicalSheets,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type ProductImage, type InsertProductImage,
  type TechnicalSheet, type InsertTechnicalSheet
} from "../shared/schema.mysql";

function generateId(): string {
  return crypto.randomUUID();
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllProducts(): Promise<Product[]>;
  getProduct(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(sku: string, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(sku: string): Promise<void>;
  
  getImagesBySku(sku: string): Promise<ProductImage[]>;
  addImage(image: InsertProductImage): Promise<ProductImage>;
  deleteImagesBySku(sku: string): Promise<void>;
  deleteImageByType(sku: string, type: string): Promise<void>;

  getTechnicalSheet(sku: string): Promise<TechnicalSheet | undefined>;
  getAllTechnicalSheets(): Promise<TechnicalSheet[]>;
  upsertTechnicalSheet(data: Omit<InsertTechnicalSheet, "id" | "createdAt" | "updatedAt">): Promise<TechnicalSheet>;
  deleteTechnicalSheet(sku: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private parseJsonFields(product: Product): Product {
    if (product.composition && typeof product.composition === 'string') {
      try {
        product.composition = JSON.parse(product.composition);
      } catch (e) {
        product.composition = null;
      }
    }
    if (product.promotions && typeof product.promotions === 'string') {
      try {
        product.promotions = JSON.parse(product.promotions);
      } catch (e) {
        product.promotions = null;
      }
    }
    if (product.badges && typeof product.badges === 'string') {
      try {
        product.badges = JSON.parse(product.badges);
      } catch (e) {
        product.badges = null;
      }
    }
    if (product.ficheTechnique && typeof product.ficheTechnique === 'string') {
      try {
        let parsed = JSON.parse(product.ficheTechnique);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        product.ficheTechnique = parsed;
      } catch (e) {
        product.ficheTechnique = null;
      }
    }
    return product;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = generateId();
    await db.insert(users).values({ ...insertUser, id });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllProducts(): Promise<Product[]> {
    const result = await db.select().from(products);
    return result.map(p => this.parseJsonFields(p));
  }

  async getProduct(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product ? this.parseJsonFields(product) : undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    await db.insert(products).values(product);
    const [created] = await db.select().from(products).where(eq(products.sku, product.sku));
    return created;
  }

  async updateProduct(sku: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    console.log('[updateProduct] SKU:', sku);
    console.log('[updateProduct] Updates received:', JSON.stringify(updates, null, 2));
    
    // Handle availability status update with raw SQL (Drizzle has issues with this column)
    if ('availabilityStatus' in updates || 'soldOutAt' in updates) {
      const status = updates.availabilityStatus || 'IN_STOCK';
      const soldOutDate = updates.soldOutAt ?? null;
      
      console.log('[updateProduct] Updating availability_status to:', status);
      console.log('[updateProduct] Updating sold_out_at to:', soldOutDate);
      
      try {
        const result = await db.execute(sql`
          UPDATE products 
          SET availability_status = ${status}, 
              sold_out_at = ${soldOutDate},
              updated_at = NOW()
          WHERE sku = ${sku}
        `);
        console.log('[updateProduct] SQL execute result:', JSON.stringify(result));
      } catch (err) {
        console.error('[updateProduct] SQL execute error:', err);
        throw err;
      }
    }

    // Handle other fields with Drizzle ORM
    const updateData: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date()
    };

    if ('prixUnitaire' in updates) updateData.prixUnitaire = updates.prixUnitaire;
    if ('prixBoite' in updates) updateData.prixBoite = updates.prixBoite;
    if ('prixPack' in updates) updateData.prixPack = updates.prixPack;
    if ('inCatalogue' in updates) updateData.inCatalogue = updates.inCatalogue;
    if ('coupDeCoeur' in updates) updateData.coupDeCoeur = updates.coupDeCoeur;
    if ('promotions' in updates) updateData.promotions = updates.promotions;
    if ('marque' in updates) updateData.marque = updates.marque;
    if ('ligne' in updates) updateData.ligne = updates.ligne;
    if ('pays' in updates) updateData.pays = updates.pays;
    if ('modele' in updates) updateData.modele = updates.modele;
    if ('vitole' in updates) updateData.vitole = updates.vitole;
    if ('format' in updates) updateData.format = updates.format;
    if ('dimensions' in updates) updateData.dimensions = updates.dimensions;
    if ('description' in updates) updateData.description = updates.description;
    if ('origine' in updates) updateData.origine = updates.origine;
    if ('puissance' in updates) updateData.puissance = updates.puissance;
    if ('rating' in updates) updateData.rating = updates.rating;
    if ('top25' in updates) updateData.top25 = updates.top25;
    if ('rank' in updates) updateData.rank = updates.rank;
    if ('year' in updates) updateData.year = updates.year;
    if ('qteBoite' in updates) updateData.qteBoite = updates.qteBoite;
    if ('quantiteBoite' in updates) updateData.quantiteBoite = updates.quantiteBoite;
    if ('quantitePack' in updates) updateData.quantitePack = updates.quantitePack;
    if ('typePack' in updates) updateData.typePack = updates.typePack;
    if ('type' in updates) updateData.type = updates.type;
    if ('badges' in updates) updateData.badges = updates.badges;
    if ('composition' in updates) updateData.composition = updates.composition;
    if ('prixBundle' in updates) updateData.prixBundle = updates.prixBundle;
    if ('ficheTechnique' in updates) updateData.ficheTechnique = updates.ficheTechnique;

    // Only run Drizzle update if there are non-status fields to update
    const hasOtherUpdates = Object.keys(updateData).length > 1;
    if (hasOtherUpdates) {
      await db
        .update(products)
        .set(updateData)
        .where(eq(products.sku, sku));
    }

    const [updated] = await db.select().from(products).where(eq(products.sku, sku));
    return updated ? this.parseJsonFields(updated) : undefined;
  }

  async deleteProduct(sku: string): Promise<void> {
    await db.delete(products).where(eq(products.sku, sku));
  }

  async getImagesBySku(sku: string): Promise<ProductImage[]> {
    return await db.select().from(productImages).where(eq(productImages.sku, sku));
  }

  async addImage(image: InsertProductImage): Promise<ProductImage> {
    const id = generateId();
    await db.insert(productImages).values({ ...image, id });
    const [created] = await db.select().from(productImages).where(eq(productImages.id, id));
    return created;
  }

  async deleteImagesBySku(sku: string): Promise<void> {
    await db.delete(productImages).where(eq(productImages.sku, sku));
  }

  async deleteImageByType(sku: string, type: string): Promise<void> {
    const images = await this.getImagesBySku(sku);
    const normalizeType = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const targetType = normalizeType(type);
    
    for (const img of images) {
      if (normalizeType(img.type) === targetType) {
        await db.delete(productImages).where(eq(productImages.id, img.id));
      }
    }
  }

  async getDistinctVitoles(): Promise<string[]> {
    const result = await db
      .selectDistinct({ vitole: products.vitole })
      .from(products)
      .where(eq(products.inCatalogue, true));
    return result
      .map(r => r.vitole)
      .filter((v): v is string => v !== null && v !== undefined && v.trim() !== '')
      .sort();
  }

  async getDistinctPays(): Promise<string[]> {
    const result = await db
      .selectDistinct({ pays: products.pays })
      .from(products)
      .where(eq(products.inCatalogue, true));
    return result
      .map(r => r.pays)
      .filter((v): v is string => v !== null && v !== undefined && v.trim() !== '')
      .sort();
  }

  async getDistinctFormats(): Promise<string[]> {
    const result = await db
      .selectDistinct({ format: products.format })
      .from(products)
      .where(eq(products.inCatalogue, true));
    return result
      .map(r => r.format)
      .filter((v): v is string => v !== null && v !== undefined && v.trim() !== '')
      .sort();
  }

  async getTechnicalSheet(sku: string): Promise<TechnicalSheet | undefined> {
    const [sheet] = await db
      .select()
      .from(productTechnicalSheets)
      .where(eq(productTechnicalSheets.sku, sku));
    return sheet;
  }

  async getAllTechnicalSheets(): Promise<TechnicalSheet[]> {
    return await db.select().from(productTechnicalSheets);
  }

  async upsertTechnicalSheet(
    data: Omit<InsertTechnicalSheet, "id" | "createdAt" | "updatedAt">,
  ): Promise<TechnicalSheet> {
    const existing = await this.getTechnicalSheet(data.sku);

    if (existing) {
      await db
        .update(productTechnicalSheets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(productTechnicalSheets.sku, data.sku));
    } else {
      await db.insert(productTechnicalSheets).values(data);
    }

    const [sheet] = await db
      .select()
      .from(productTechnicalSheets)
      .where(eq(productTechnicalSheets.sku, data.sku));
    return sheet;
  }

  async deleteTechnicalSheet(sku: string): Promise<void> {
    await db.delete(productTechnicalSheets).where(eq(productTechnicalSheets.sku, sku));
  }
}

export const storage = new DatabaseStorage();
