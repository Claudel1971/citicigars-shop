import { API_URL } from '../config';

const API_BASE = `${API_URL}/api`;

class ApiService {
  async getAllProducts() {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  }

  async getProduct(sku) {
    const response = await fetch(`${API_BASE}/products/${sku}`);
    if (!response.ok) throw new Error('Failed to fetch product');
    return response.json();
  }

  async updateProduct(sku, updates) {
    const response = await fetch(`${API_BASE}/products/${sku}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update product');
    return response.json();
  }

  async createProduct(product) {
    const response = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create product');
    }
    return response.json();
  }

  async deleteProduct(sku) {
    const response = await fetch(`${API_BASE}/products/${sku}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete product');
    return response.json();
  }

  async uploadImages(sku, images) {
    console.log(`📤 Uploading ${images.length} images for ${sku}...`);
    try {
      const response = await fetch(`${API_BASE}/products/${sku}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Upload failed for ${sku}: ${response.status} - ${errorText}`);
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
      }
      
      console.log(`✅ Upload success for ${sku}`);
      return response.json();
    } catch (error) {
      console.error(`❌ Network/Upload error for ${sku}:`, error.message);
      throw error;
    }
  }

  async deleteImages(sku) {
    const response = await fetch(`${API_BASE}/products/${sku}/images`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete images');
    return response.json();
  }

  async deleteImageByType(sku, type) {
    const response = await fetch(`${API_BASE}/products/${sku}/images/${type}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete image');
    return response.json();
  }

  async seedDatabase() {
    const response = await fetch(`${API_BASE}/seed`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to seed database');
    return response.json();
  }

  async bulkUpdatePrices(updates) {
    const response = await fetch(`${API_BASE}/products/bulk-update-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!response.ok) throw new Error('Failed to bulk update prices');
    return response.json();
  }

  async bulkUpdatePuissance(updates) {
    const response = await fetch(`${API_BASE}/products/bulk-update-puissance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!response.ok) throw new Error('Failed to bulk update puissance');
    return response.json();
  }

  async importProducts(products) {
    const response = await fetch(`${API_BASE}/products/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to import products: ${errorText}`);
    }
    return response.json();
  }

  async getProductImages(sku) {
    const response = await fetch(`${API_BASE}/products/${sku}/images`);
    if (!response.ok) return null;
    return response.json();
  }

  async getDistinctVitoles() {
    const response = await fetch(`${API_BASE}/filters/vitoles`);
    if (!response.ok) throw new Error('Failed to fetch vitoles');
    return response.json();
  }

  async getDistinctPays() {
    const response = await fetch(`${API_BASE}/filters/pays`);
    if (!response.ok) throw new Error('Failed to fetch pays');
    return response.json();
  }

  async getDistinctFormats() {
    const response = await fetch(`${API_BASE}/filters/formats`);
    if (!response.ok) throw new Error('Failed to fetch formats');
    return response.json();
  }
}

const apiService = new ApiService();
export default apiService;
