import { db } from "./db.mysql";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { 
  users, products, productImages,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type ProductImage, type InsertProductImage
} from "../shared/schema.mysql";

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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = nanoid(36);
    await db.insert(users).values({ ...insertUser, id });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    await db.insert(products).values(product);
    const [created] = await db.select().from(products).where(eq(products.sku, product.sku));
    return created;
  }

  async updateProduct(sku: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.sku, sku));
    const [updated] = await db.select().from(products).where(eq(products.sku, sku));
    return updated;
  }

  async deleteProduct(sku: string): Promise<void> {
    await db.delete(products).where(eq(products.sku, sku));
  }

  async getImagesBySku(sku: string): Promise<ProductImage[]> {
    return await db.select().from(productImages).where(eq(productImages.sku, sku));
  }

  async addImage(image: InsertProductImage): Promise<ProductImage> {
    const id = nanoid(36);
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
}

export const storage = new DatabaseStorage();
