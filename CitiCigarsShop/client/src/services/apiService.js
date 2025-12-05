const API_BASE = '/api';

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

  async deleteProduct(sku) {
    const response = await fetch(`${API_BASE}/products/${sku}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete product');
    return response.json();
  }

  async uploadImages(sku, images) {
    const response = await fetch(`${API_BASE}/products/${sku}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });
    if (!response.ok) throw new Error('Failed to upload images');
    return response.json();
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
}

const apiService = new ApiService();
export default apiService;
