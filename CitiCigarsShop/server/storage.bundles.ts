import { db } from "./db.mysql";
import { eq, sql } from "drizzle-orm";
import { bundles, bundleItems, Bundle, InsertBundle, BundleItem, InsertBundleItem } from "../shared/schema.bundles";
import { products } from "../shared/schema.mysql";

export interface BundleWithItems extends Bundle {
  items: BundleItem[];
}

export interface BundleItemWithProduct extends BundleItem {
  product?: {
    sku: string;
    marque: string;
    ligne: string | null;
    prixUnitaire: number | null;
    imagePrincipale?: string;
  };
}

export class BundleStorage {
  async getAllBundles(): Promise<BundleWithItems[]> {
    const allBundles = await db.select().from(bundles);
    
    const bundlesWithItems = await Promise.all(
      allBundles.map(async (bundle) => {
        const items = await db
          .select()
          .from(bundleItems)
          .where(eq(bundleItems.bundleSku, bundle.sku));
        
        return { ...bundle, items };
      })
    );
    
    return bundlesWithItems;
  }

  async getBundleBySku(sku: string): Promise<BundleWithItems | undefined> {
    const [bundle] = await db.select().from(bundles).where(eq(bundles.sku, sku));
    if (!bundle) return undefined;

    const items = await db
      .select()
      .from(bundleItems)
      .where(eq(bundleItems.bundleSku, sku));

    return { ...bundle, items };
  }

  async getBundleWithProducts(sku: string): Promise<(Bundle & { items: BundleItemWithProduct[] }) | undefined> {
    const [bundle] = await db.select().from(bundles).where(eq(bundles.sku, sku));
    if (!bundle) return undefined;

    const items = await db
      .select()
      .from(bundleItems)
      .where(eq(bundleItems.bundleSku, sku));

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        if (item.productSku) {
          const [product] = await db
            .select({
              sku: products.sku,
              marque: products.marque,
              ligne: products.ligne,
              prixUnitaire: products.prixUnitaire,
            })
            .from(products)
            .where(eq(products.sku, item.productSku));
          
          return { ...item, product: product || undefined };
        }
        return { ...item, product: undefined };
      })
    );

    return { ...bundle, items: itemsWithProducts };
  }

  async createBundle(
    bundleData: InsertBundle,
    items: Array<{ productSku: string; quantite: number; marque?: string; modele?: string; rating?: string; top25?: string }>
  ): Promise<BundleWithItems> {
    await db.insert(bundles).values(bundleData);

    for (const item of items) {
      let prixUnitaire: number | null = null;
      
      if (item.productSku) {
        const [product] = await db
          .select({ prixUnitaire: products.prixUnitaire })
          .from(products)
          .where(eq(products.sku, item.productSku));
        prixUnitaire = product?.prixUnitaire || null;
      }
      
      await db.insert(bundleItems).values({
        bundleSku: bundleData.sku,
        productSku: item.productSku,
        quantite: item.quantite,
        prixUnitaire,
        marque: item.marque,
        modele: item.modele,
        rating: item.rating,
        top25: item.top25,
      });
    }

    const created = await this.getBundleBySku(bundleData.sku);
    return created!;
  }

  async updateBundle(
    sku: string,
    bundleData: Partial<InsertBundle>,
    items?: Array<{ productSku: string; quantite: number; marque?: string; modele?: string; rating?: string; top25?: string }>
  ): Promise<BundleWithItems | undefined> {
    const existing = await this.getBundleBySku(sku);
    if (!existing) return undefined;

    if (Object.keys(bundleData).length > 0) {
      await db
        .update(bundles)
        .set({ ...bundleData, updatedAt: new Date() })
        .where(eq(bundles.sku, sku));
    }

    if (items) {
      await db.delete(bundleItems).where(eq(bundleItems.bundleSku, sku));

      for (const item of items) {
        let prixUnitaire: number | null = null;
        
        if (item.productSku) {
          const [product] = await db
            .select({ prixUnitaire: products.prixUnitaire })
            .from(products)
            .where(eq(products.sku, item.productSku));
          prixUnitaire = product?.prixUnitaire || null;
        }
        
        await db.insert(bundleItems).values({
          bundleSku: sku,
          productSku: item.productSku,
          quantite: item.quantite,
          prixUnitaire,
          marque: item.marque,
          modele: item.modele,
          rating: item.rating,
          top25: item.top25,
        });
      }
    }

    return await this.getBundleBySku(sku);
  }

  async updateBundleAvailability(sku: string, status: string, soldOutAt?: Date): Promise<BundleWithItems | undefined> {
    const existing = await this.getBundleBySku(sku);
    if (!existing) return undefined;

    await db.execute(sql`
      UPDATE bundles 
      SET availability_status = ${status}, 
          sold_out_at = ${soldOutAt || null},
          updated_at = NOW()
      WHERE sku = ${sku}
    `);
    
    return await this.getBundleBySku(sku);
  }

  async deleteBundle(sku: string): Promise<boolean> {
    const existing = await this.getBundleBySku(sku);
    if (!existing) return false;
    
    await db.delete(bundles).where(eq(bundles.sku, sku));
    return true;
  }

  async calculateSuggestedPrice(items: Array<{ productSku: string; quantite: number }>): Promise<number> {
    let total = 0;

    for (const item of items) {
      const [product] = await db
        .select({ prixUnitaire: products.prixUnitaire })
        .from(products)
        .where(eq(products.sku, item.productSku));
      
      if (product?.prixUnitaire) {
        total += product.prixUnitaire * item.quantite;
      }
    }

    return total;
  }

  async getProductsForSelection(): Promise<Array<{ sku: string; marque: string; ligne: string | null; modele: string | null; prixUnitaire: number | null }>> {
    const productList = await db
      .select({
        sku: products.sku,
        marque: products.marque,
        ligne: products.ligne,
        modele: products.modele,
        prixUnitaire: products.prixUnitaire,
      })
      .from(products)
      .where(eq(products.inCatalogue, true));
    
    return productList.sort((a, b) => a.sku.localeCompare(b.sku));
  }
}

export const bundleStorage = new BundleStorage();
