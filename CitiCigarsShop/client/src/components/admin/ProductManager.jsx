import React, { useState, useEffect, useMemo } from 'react';
import apiService from '@/services/apiService';
import { Search, Loader2, Package } from 'lucide-react';

const ProductManager = () => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const normaliserRabais = (rabais) => {
    if (!rabais || rabais === 0) return 0;
    return Math.abs(rabais);
  };

  const arrondirMultiple = (valeur, multiple = 50) => {
    return Math.round(valeur / multiple) * multiple;
  };

  const calculerPrixPromo = (prixUnitaire, rabais) => {
    const rabaisPositif = normaliserRabais(rabais);
    if (rabaisPositif === 0) return null;
    const prixAvecRabais = prixUnitaire * (1 - rabaisPositif / 100);
    return arrondirMultiple(prixAvecRabais, 50);
  };

  const calculerPrixPack = (prixUnitaire, qtyPack, rabais = 0) => {
    const rabaisPositif = normaliserRabais(rabais);
    const prixBase = prixUnitaire * qtyPack;
    if (rabaisPositif > 0) {
      const prixAvecRabais = prixBase * (1 - rabaisPositif / 100);
      return arrondirMultiple(prixAvecRabais, 50);
    }
    return prixBase;
  };

  const calculerPrixBoite = (prixUnitaire, qtyBoite = 25, rabais = 0) => {
    const rabaisPositif = normaliserRabais(rabais);
    const prixBase = prixUnitaire * qtyBoite;
    if (rabaisPositif > 0) {
      const prixAvecRabais = prixBase * (1 - rabaisPositif / 100);
      return arrondirMultiple(prixAvecRabais, 50);
    }
    return prixBase;
  };

  const handleUpdatePricing = async (sku, newPrixUnitaire, newRabais) => {
    const product = products.find(p => p.sku === sku);
    if (!product) return;

    setUpdating(sku);
    const rabaisPositif = normaliserRabais(newRabais);
    const qtyPack = product.quantitePack || product.typePack || 4;
    const qtyBoite = product.qteBoite || product.quantiteBoite || 25;

    const prixPromoUnitaire = calculerPrixPromo(newPrixUnitaire, rabaisPositif);
    const prixPack = calculerPrixPack(newPrixUnitaire, qtyPack, rabaisPositif);
    const prixBoite = calculerPrixBoite(newPrixUnitaire, qtyBoite, rabaisPositif);

    const updatedProduct = {
      prixUnitaire: newPrixUnitaire,
      prixPack: rabaisPositif > 0 ? prixPack : product.prixPack,
      prixBoite: rabaisPositif > 0 ? prixBoite : product.prixBoite,
      promotions: {
        unitaire: {
          actif: rabaisPositif > 0,
          pourcentage: rabaisPositif,
          prixPromo: prixPromoUnitaire
        },
        pack: {
          actif: rabaisPositif > 0,
          pourcentage: rabaisPositif,
          prixPromo: prixPack
        },
        boite: {
          actif: rabaisPositif > 0,
          pourcentage: rabaisPositif,
          prixPromo: prixBoite
        }
      }
    };

    try {
      await apiService.updateProduct(sku, updatedProduct);
      await loadProducts();
    } catch (error) {
      console.error('Erreur mise à jour prix:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setUpdating(null);
    }
  };

  const handlePriceChange = async (sku, newPrixUnitaire) => {
    const product = products.find(p => p.sku === sku);
    if (!product) return;
    const rabaisActuel = product.promotions?.unitaire?.pourcentage || 0;
    await handleUpdatePricing(sku, newPrixUnitaire, rabaisActuel);
  };

  const handleRabaisChange = async (sku, newRabais) => {
    const product = products.find(p => p.sku === sku);
    if (!product) return;
    await handleUpdatePricing(sku, product.prixUnitaire, newRabais);
  };

  const handleToggleCatalogue = async (sku, newStatus) => {
    setUpdating(sku);
    try {
      await apiService.updateProduct(sku, { inCatalogue: newStatus });
      await loadProducts();
    } catch (error) {
      console.error('Erreur toggle catalogue:', error);
      alert('Erreur lors du changement de visibilité');
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleCoupDeCoeur = async (sku, newStatus) => {
    setUpdating(sku);
    try {
      await apiService.updateProduct(sku, { coupDeCoeur: newStatus });
      await loadProducts();
    } catch (error) {
      console.error('Erreur toggle coup de coeur:', error);
      alert('Erreur lors du changement');
    } finally {
      setUpdating(null);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await apiService.getAllProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;

    switch (filter) {
      case 'visible':
        result = products.filter(p => p.inCatalogue !== false);
        break;
      case 'hidden':
        result = products.filter(p => p.inCatalogue === false);
        break;
      case 'promo':
        result = products.filter(p => p.promotions?.unitaire?.actif === true);
        break;
      case 'favorite':
        result = products.filter(p => p.coupDeCoeur === true);
        break;
      default:
        result = products;
    }

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(p =>
        p.marque?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.modele?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => (a.marque || '').localeCompare(b.marque || ''));
  }, [products, filter, search]);

  const formatPrice = (price) => {
    if (!price && price !== 0) return '-';
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getProductImage = (product) => {
    return product.imagePrincipale || product.imageSolo || product.imageBoite || null;
  };

  const visibleCount = products.filter(p => p.inCatalogue !== false).length;
  const hiddenCount = products.filter(p => p.inCatalogue === false).length;
  const promoCount = products.filter(p => p.promotions?.unitaire?.actif === true).length;
  const favoriteCount = products.filter(p => p.coupDeCoeur === true).length;

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p>Chargement des produits...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary mb-2">
          Gestion des Produits
        </h1>
        <p className="text-muted-foreground">
          Gerez la visibilite, les prix, les promotions et les coups de coeur
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative w-full lg:w-80">
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
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Tous ({products.length})
            </button>
            <button
              onClick={() => setFilter('visible')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'visible' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Visibles ({visibleCount})
            </button>
            <button
              onClick={() => setFilter('hidden')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'hidden' ? 'bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Masques ({hiddenCount})
            </button>
            <button
              onClick={() => setFilter('promo')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'promo' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              En promo ({promoCount})
            </button>
            <button
              onClick={() => setFilter('favorite')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'favorite' ? 'bg-pink-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Coups de coeur ({favoriteCount})
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Image</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Nom</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Prix Unitaire</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Rabais %</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Prix Final</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Prix Pack</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase">Prix Boite</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Stock</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Catalogue</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase">Coup de coeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun produit trouve</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((produit) => {
                  const image = getProductImage(produit);
                  const isUpdating = updating === produit.sku;
                  const qtyPack = produit.quantitePack || produit.typePack || 4;
                  const qtyBoite = produit.qteBoite || produit.quantiteBoite || 25;
                  const rabais = produit.promotions?.unitaire?.pourcentage || 0;

                  return (
                    <tr key={produit.sku} className={`hover:bg-gray-50 transition-colors ${isUpdating ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          {image ? (
                            <img src={image} alt={produit.marque} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-gray-900">
                            {produit.marque}{produit.ligne ? `, ${produit.ligne}` : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">SKU: {produit.sku}</span>
                          <div className="flex gap-1 flex-wrap">
                            {produit.promotions?.unitaire?.actif && (
                              <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                                -{Math.abs(rabais)}%
                              </span>
                            )}
                            {produit.coupDeCoeur && (
                              <span className="bg-pink-500 text-white px-2 py-0.5 rounded text-xs">
                                Coup de coeur
                              </span>
                            )}
                            {produit.inCatalogue === false && (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs">
                                Masque
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="50"
                            value={produit.prixUnitaire || 0}
                            onChange={(e) => handlePriceChange(produit.sku, parseInt(e.target.value) || 0)}
                            disabled={isUpdating}
                            className="w-24 px-2 py-1 border rounded text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
                          />
                          <span className="text-xs text-gray-500">FCFA</span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-red-500 font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.abs(rabais)}
                            onChange={(e) => handleRabaisChange(produit.sku, parseInt(e.target.value) || 0)}
                            disabled={isUpdating}
                            className="w-16 px-2 py-1 border rounded text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {produit.promotions?.unitaire?.actif ? (
                          <div className="flex flex-col">
                            <span className="text-red-600 font-bold">
                              {formatPrice(produit.promotions.unitaire.prixPromo)} FCFA
                            </span>
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(produit.prixUnitaire)} FCFA
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold">
                            {formatPrice(produit.prixUnitaire)} FCFA
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-xs">Pack ({qtyPack})</div>
                          <div>
                            {formatPrice(calculerPrixPack(produit.prixUnitaire, qtyPack, rabais))} FCFA
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-xs">Boite ({qtyBoite})</div>
                          <div>
                            {formatPrice(calculerPrixBoite(produit.prixUnitaire, qtyBoite, rabais))} FCFA
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className="text-gray-600">-</span>
                      </td>

                      <td className="px-3 py-3">
                        <label className="flex flex-col items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={produit.inCatalogue !== false}
                            onChange={() => handleToggleCatalogue(produit.sku, produit.inCatalogue === false)}
                            disabled={isUpdating}
                            className="sr-only peer"
                          />
                          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                          <span className="text-xs font-medium mt-1">
                            {produit.inCatalogue !== false ? 'Visible' : 'Masque'}
                          </span>
                        </label>
                      </td>

                      <td className="px-3 py-3">
                        <label className="flex flex-col items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={produit.coupDeCoeur || false}
                            onChange={() => handleToggleCoupDeCoeur(produit.sku, !produit.coupDeCoeur)}
                            disabled={isUpdating}
                            className="sr-only peer"
                          />
                          <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                          <span className="text-2xl mt-1">
                            {produit.coupDeCoeur ? '\u2764\uFE0F' : '\u{1F90D}'}
                          </span>
                        </label>
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
        {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} affiche{filteredProducts.length > 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default ProductManager;
