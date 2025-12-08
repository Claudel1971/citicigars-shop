// IndexedDB Service for CitiCigars
const DB_NAME = "CitiCigarsDB";
const DB_VERSION = 1;

const STORES = {
  PRODUCTS: "products",
  IMAGES: "images",
  ASSOCIATIONS: "associations",
};

const normalizeType = (type) =>
  (type || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, {
            keyPath: "sku",
          });
          productStore.createIndex("marque", "marque", { unique: false });
          productStore.createIndex("origine", "origine", { unique: false });
          productStore.createIndex("type", "type", { unique: false });
          productStore.createIndex("inCatalogue", "inCatalogue", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(STORES.IMAGES)) {
          const imageStore = db.createObjectStore(STORES.IMAGES, {
            keyPath: "id",
            autoIncrement: true,
          });
          imageStore.createIndex("sku", "sku", { unique: false });
          imageStore.createIndex("type", "type", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.ASSOCIATIONS)) {
          const assocStore = db.createObjectStore(STORES.ASSOCIATIONS, {
            keyPath: "id",
            autoIncrement: true,
          });
          assocStore.createIndex("bundleSku", "bundleSku", { unique: false });
        }
      };
    });
  }

  async addProduct(product) {
    const tx = this.db.transaction(STORES.PRODUCTS, "readwrite");
    const store = tx.objectStore(STORES.PRODUCTS);
    return new Promise((resolve, reject) => {
      const request = store.add(product);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateProduct(product) {
    const tx = this.db.transaction(STORES.PRODUCTS, "readwrite");
    const store = tx.objectStore(STORES.PRODUCTS);
    return new Promise((resolve, reject) => {
      const request = store.put(product);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getProduct(sku) {
    const tx = this.db.transaction(STORES.PRODUCTS, "readonly");
    const store = tx.objectStore(STORES.PRODUCTS);
    return new Promise((resolve, reject) => {
      const request = store.get(sku);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProducts() {
    const tx = this.db.transaction(STORES.PRODUCTS, "readonly");
    const store = tx.objectStore(STORES.PRODUCTS);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProduct(sku) {
    const tx = this.db.transaction(STORES.PRODUCTS, "readwrite");
    const store = tx.objectStore(STORES.PRODUCTS);
    return new Promise((resolve, reject) => {
      const request = store.delete(sku);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addImage(imageData) {
    const tx = this.db.transaction(STORES.IMAGES, "readwrite");
    const store = tx.objectStore(STORES.IMAGES);
    return new Promise((resolve, reject) => {
      const request = store.add(imageData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getImagesBySku(sku) {
    const tx = this.db.transaction(STORES.IMAGES, "readonly");
    const store = tx.objectStore(STORES.IMAGES);
    const index = store.index("sku");
    return new Promise((resolve, reject) => {
      const request = index.getAll(sku);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImagesBySku(sku) {
    const images = await this.getImagesBySku(sku);
    const tx = this.db.transaction(STORES.IMAGES, "readwrite");
    const store = tx.objectStore(STORES.IMAGES);

    return Promise.all(
      images.map(
        (img) =>
          new Promise((resolve, reject) => {
            const request = store.delete(img.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }),
      ),
    );
  }

  async getProductWithImages(sku) {
    // 🔧 FIX: Ensure DB is initialized
    if (!this.db) {
      await this.init();
    }

    const product = await this.getProduct(sku);
    if (!product) return null;

    const images = await this.getImagesBySku(sku);

    // Image mapping - map to standard fields including pack variants
    const imageMap = {
      imagePrincipale: null,
      imageSolo: null,
      imagePack: null,
      imagePack4: null,
      imagePack5: null,
      imageBoite: null,
    };

    images.forEach((img) => {
      const t = normalizeType(img.type);

      // Principale (includes open box variants)
      if (t.includes('principale') || t.includes('open') || t.includes('defaut')) {
        imageMap.imagePrincipale = img.data;
      }
      // Solo
      else if (t.includes('solo') || t.includes('cigare')) {
        imageMap.imageSolo = img.data;
      }
      // Pack 4 (specific)
      else if (t === 'pack4' || t.includes('pack_4') || t.includes('pack (4)')) {
        imageMap.imagePack4 = img.data;
        if (!imageMap.imagePack) imageMap.imagePack = img.data;
      }
      // Pack 5 (specific)
      else if (t === 'pack5' || t.includes('pack_5') || t.includes('pack (5)')) {
        imageMap.imagePack5 = img.data;
        if (!imageMap.imagePack) imageMap.imagePack = img.data;
      }
      // Pack (generic fallback)
      else if (t.includes('pack')) {
        imageMap.imagePack = img.data;
      }
      // Boîte
      else if (t.includes('boite') || t.includes('closed')) {
        imageMap.imageBoite = img.data;
      }
    });

    // Return product with mapped images
    return {
      ...product,
      ...imageMap,
      images, // Keep raw images array for reference
    };
  }

  async getAllProductsWithImages() {
    // 🔧 FIX: Ensure DB is initialized
    if (!this.db) {
      await this.init();
    }

    const products = await this.getAllProducts();
    return Promise.all(products.map((p) => this.getProductWithImages(p.sku)));
  }

  async migrateFromLocalStorage() {
    const localProducts = localStorage.getItem("citicigars-products");
    if (!localProducts) return;

    const products = JSON.parse(localProducts);

    for (const product of products) {
      const {
        imagePrincipale,
        imageSolo,
        imagePack,
        imageBoite,
        ...productData
      } = product;

      await this.addProduct(productData);

      if (imagePrincipale) {
        await this.addImage({
          sku: product.sku,
          type: "principale",
          data: imagePrincipale,
        });
      }
      if (imageSolo) {
        await this.addImage({
          sku: product.sku,
          type: "solo",
          data: imageSolo,
        });
      }
      if (imagePack) {
        await this.addImage({
          sku: product.sku,
          type: "pack",
          data: imagePack,
        });
      }
      if (imageBoite) {
        await this.addImage({
          sku: product.sku,
          type: "boite",
          data: imageBoite,
        });
      }
    }

    console.log(
      `✅ Migrated ${products.length} products from localStorage to IndexedDB`,
    );
  }
}

const dbService = new IndexedDBService();
export default dbService;
