import React, { useState, useMemo } from 'react';
import { useProducts } from '@/context/ProductContext';
import apiService from '@/services/apiService';
import { Search, Eye, EyeOff, Package, Loader2 } from 'lucide-react';

const ProductManager = () => {
  const { products, refreshProducts } = useProducts();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  const isProductVisible = (p) => p.inCatalogue !== false;

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filter === 'visible' && !isProductVisible(p)) return false;
      if (filter === 'hidden' && isProductVisible(p)) return false;

      if (search) {
        const query = search.toLowerCase();
        return (
          p.marque?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.modele?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [products, filter, search]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) =>
      (a.marque || '').localeCompare(b.marque || '')
    );
  }, [filteredProducts]);

  const handleToggle = async (product) => {
    setUpdating(product.sku);
    try {
      const newValue = product.inCatalogue === false ? true : false;
      await apiService.updateProduct(product.sku, { inCatalogue: newValue });
      await refreshProducts();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour du produit');
    } finally {
      setUpdating(null);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const getProductImage = (product) => {
    return product.imagePrincipale || product.imageSolo || product.imageBoite || null;
  };

  const visibleCount = products.filter(isProductVisible).length;
  const hiddenCount = products.filter((p) => !isProductVisible(p)).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary mb-2">
          Gestion des Produits
        </h1>
        <p className="text-muted-foreground">
          Contrôlez la visibilité des produits dans le catalogue client
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom ou SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({products.length})
            </button>
            <button
              onClick={() => setFilter('visible')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filter === 'visible'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="h-4 w-4" />
              Visibles ({visibleCount})
            </button>
            <button
              onClick={() => setFilter('hidden')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filter === 'hidden'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <EyeOff className="h-4 w-4" />
              Masqués ({hiddenCount})
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Prix Unitaire
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Catalogue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun produit trouvé</p>
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product) => {
                  const image = getProductImage(product);
                  const isUpdating = updating === product.sku;

                  return (
                    <tr key={product.sku} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          {image ? (
                            <img
                              src={image}
                              alt={product.marque}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {product.marque}
                            {product.ligne ? `, ${product.ligne}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.sku}
                          </p>
                          {product.vitole && (
                            <p className="text-xs text-muted-foreground">
                              {product.vitole}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {formatPrice(product.prixUnitaire)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">-</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleToggle(product)}
                            disabled={isUpdating}
                            className={`
                              relative inline-flex h-7 w-14 items-center rounded-full transition-colors
                              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50
                              ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                              ${isProductVisible(product) ? 'bg-green-500' : 'bg-gray-300'}
                            `}
                          >
                            {isUpdating ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-white" />
                              </span>
                            ) : (
                              <span
                                className={`
                                  inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform
                                  ${isProductVisible(product) ? 'translate-x-8' : 'translate-x-1'}
                                `}
                              />
                            )}
                          </button>
                        </div>
                        <p className={`text-xs text-center mt-1 font-medium ${
                          isProductVisible(product) ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {isProductVisible(product) ? 'Visible' : 'Masqué'}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground text-center">
        {sortedProducts.length} produit{sortedProducts.length > 1 ? 's' : ''} affiché{sortedProducts.length > 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default ProductManager;
