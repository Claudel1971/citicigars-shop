import React, { useState, useEffect, useMemo } from 'react';
import apiService from '@/services/apiService';
import { Search, Loader2, Package, Save, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const ProductManager = () => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});

  const normaliserRabais = (rabais) => {
    if (!rabais || rabais === 0) return 0;
    return Math.abs(rabais);
  };

  const arrondirMultiple = (valeur, multiple = 250) => {
    return Math.round(valeur / multiple) * multiple;
  };

  const calculerPrixPromo = (prixUnitaire, rabais) => {
    const rabaisPositif = normaliserRabais(rabais);
    if (rabaisPositif === 0) return null;
    const prixAvecRabais = prixUnitaire * (1 - rabaisPositif / 100);
    return arrondirMultiple(prixAvecRabais, 250);
  };

  const calculerPrixPack = (prixUnitaire, qtyPack, rabais = 0) => {
    const rabaisPositif = normaliserRabais(rabais);
    const prixBase = prixUnitaire * qtyPack;
    if (rabaisPositif > 0) {
      const prixAvecRabais = prixBase * (1 - rabaisPositif / 100);
      return arrondirMultiple(prixAvecRabais, 250);
    }
    return prixBase;
  };

  const calculerPrixBoite = (prixUnitaire, qtyBoite = 25, rabais = 0) => {
    const rabaisPositif = normaliserRabais(rabais);
    const prixBase = prixUnitaire * qtyBoite;
    if (rabaisPositif > 0) {
      const prixAvecRabais = prixBase * (1 - rabaisPositif / 100);
      return arrondirMultiple(prixAvecRabais, 250);
    }
    return prixBase;
  };

  const getProductWithChanges = (sku) => {
    const original = products.find(p => p.sku === sku);
    if (!original) return null;
    const changes = pendingChanges[sku] || {};
    return { ...original, ...changes };
  };

  const handleLocalChange = (sku, field, value) => {
    setPendingChanges(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [field]: value
      }
    }));
  };

  const handlePriceChange = (sku, newPrixUnitaire) => {
    handleLocalChange(sku, 'prixUnitaire', parseInt(newPrixUnitaire) || 0);
  };

  const handleRabaisChange = (sku, newRabais) => {
    handleLocalChange(sku, 'rabais', parseInt(newRabais) || 0);
  };

  const handleToggleCatalogue = (sku, newStatus) => {
    handleLocalChange(sku, 'inCatalogue', newStatus);
  };

  const handleToggleCoupDeCoeur = (sku, newStatus) => {
    handleLocalChange(sku, 'coupDeCoeur', newStatus);
  };

  const pendingCount = Object.keys(pendingChanges).length;

  const discardChanges = () => {
    if (pendingCount > 0 && confirm(`Annuler ${pendingCount} modification(s) en attente ?`)) {
      setPendingChanges({});
      toast.info('Modifications annulees');
    }
  };

  const saveAllChanges = async () => {
    if (pendingCount === 0) return;
    
    setSaving(true);

    try {
      const updatePromises = Object.entries(pendingChanges).map(async ([sku, changes]) => {
        const product = products.find(p => p.sku === sku);
        if (!product) {
          console.warn(`Produit ${sku} non trouve`);
          return { success: false, sku };
        }

        const updatedData = {};

        if ('prixUnitaire' in changes || 'rabais' in changes) {
          const newPrixUnitaire = changes.prixUnitaire ?? product.prixUnitaire;
          const newRabais = normaliserRabais(changes.rabais ?? product.promotions?.unitaire?.pourcentage ?? 0);
          const qtyPack = product.quantitePack || product.typePack || 4;
          const qtyBoite = product.qteBoite || product.quantiteBoite || 25;

          const prixPromoUnitaire = calculerPrixPromo(newPrixUnitaire, newRabais);
          const prixPack = calculerPrixPack(newPrixUnitaire, qtyPack, newRabais);
          const prixBoite = calculerPrixBoite(newPrixUnitaire, qtyBoite, newRabais);

          updatedData.prixUnitaire = newPrixUnitaire;
          updatedData.prixPack = prixPack;
          updatedData.prixBoite = prixBoite;
          updatedData.promotions = {
            unitaire: {
              actif: newRabais > 0,
              pourcentage: newRabais,
              prixPromo: prixPromoUnitaire
            },
            pack: {
              actif: newRabais > 0,
              pourcentage: newRabais,
              prixPromo: prixPack
            },
            boite: {
              actif: newRabais > 0,
              pourcentage: newRabais,
              prixPromo: prixBoite
            }
          };
        }

        if ('inCatalogue' in changes) {
          updatedData.inCatalogue = changes.inCatalogue;
        }

        if ('coupDeCoeur' in changes) {
          updatedData.coupDeCoeur = changes.coupDeCoeur;
        }

        try {
          await apiService.updateProduct(sku, updatedData);
          return { success: true, sku };
        } catch (error) {
          console.error(`Erreur sauvegarde ${sku}:`, error);
          return { success: false, sku, error };
        }
      });

      const results = await Promise.all(updatePromises);

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      if (errorCount === 0) {
        toast.success(`${successCount} produit(s) sauvegarde(s) avec succes`);
      } else {
        toast.success(`${successCount} produit(s) sauvegarde(s)`);
        toast.error(`${errorCount} erreur(s) lors de la sauvegarde`);
      }

      setPendingChanges({});
      await loadProducts();

    } catch (error) {
      console.error('Erreur sauvegarde globale:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await apiService.getAllProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products.map(p => {
      const changes = pendingChanges[p.sku] || {};
      return { ...p, ...changes, _hasChanges: !!pendingChanges[p.sku] };
    });

    switch (filter) {
      case 'visible':
        result = result.filter(p => p._hasChanges || p.inCatalogue !== false);
        break;
      case 'hidden':
        result = result.filter(p => p._hasChanges || p.inCatalogue === false);
        break;
      case 'promo':
        result = result.filter(p => p._hasChanges || p.promotions?.unitaire?.actif === true || (pendingChanges[p.sku]?.rabais > 0));
        break;
      case 'favorite':
        result = result.filter(p => p._hasChanges || p.coupDeCoeur === true);
        break;
      case 'modified':
        result = result.filter(p => p._hasChanges);
        break;
      default:
        result = result;
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
  }, [products, filter, search, pendingChanges]);

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
    <div className="p-6 max-w-full pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary mb-2">
          Gestion des Produits
        </h1>
        <p className="text-muted-foreground">
          Modifiez vos produits librement. Les changements ne seront enregistres qu'apres avoir clique sur "Sauvegarder".
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
            {pendingCount > 0 && (
              <button
                onClick={() => setFilter('modified')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'modified' ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                Modifies ({pendingCount})
              </button>
            )}
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
                  const hasChanges = produit._hasChanges;
                  const changes = pendingChanges[produit.sku] || {};
                  const originalProduct = products.find(p => p.sku === produit.sku);

                  const currentPrixUnitaire = changes.prixUnitaire ?? produit.prixUnitaire ?? 0;
                  const currentRabais = changes.rabais ?? produit.promotions?.unitaire?.pourcentage ?? 0;
                  const currentInCatalogue = 'inCatalogue' in changes ? changes.inCatalogue : produit.inCatalogue !== false;
                  const currentCoupDeCoeur = 'coupDeCoeur' in changes ? changes.coupDeCoeur : produit.coupDeCoeur || false;

                  const qtyPack = produit.quantitePack || produit.typePack || 4;
                  const qtyBoite = produit.qteBoite || produit.quantiteBoite || 25;

                  const prixFinal = currentRabais > 0 
                    ? calculerPrixPromo(currentPrixUnitaire, currentRabais)
                    : currentPrixUnitaire;
                  const prixPack = calculerPrixPack(currentPrixUnitaire, qtyPack, currentRabais);
                  const prixBoite = calculerPrixBoite(currentPrixUnitaire, qtyBoite, currentRabais);

                  return (
                    <tr 
                      key={produit.sku} 
                      className={`hover:bg-gray-50 transition-colors ${hasChanges ? 'bg-orange-50 border-l-4 border-l-orange-400' : ''}`}
                    >
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
                            {hasChanges && (
                              <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                                Modifie
                              </span>
                            )}
                            {currentRabais > 0 && (
                              <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                                -{Math.abs(currentRabais)}%
                              </span>
                            )}
                            {currentCoupDeCoeur && (
                              <span className="bg-pink-500 text-white px-2 py-0.5 rounded text-xs">
                                Coup de coeur
                              </span>
                            )}
                            {!currentInCatalogue && (
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
                            value={currentPrixUnitaire}
                            onChange={(e) => handlePriceChange(produit.sku, e.target.value)}
                            className={`w-24 px-2 py-1 border rounded text-sm focus:border-blue-500 focus:outline-none ${
                              'prixUnitaire' in changes ? 'border-orange-400 bg-orange-50' : ''
                            }`}
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
                            value={Math.abs(currentRabais)}
                            onChange={(e) => handleRabaisChange(produit.sku, e.target.value)}
                            className={`w-16 px-2 py-1 border rounded text-sm focus:border-blue-500 focus:outline-none ${
                              'rabais' in changes ? 'border-orange-400 bg-orange-50' : ''
                            }`}
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {currentRabais > 0 ? (
                          <div className="flex flex-col">
                            <span className="text-red-600 font-bold">
                              {formatPrice(prixFinal)} FCFA
                            </span>
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(currentPrixUnitaire)} FCFA
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold">
                            {formatPrice(currentPrixUnitaire)} FCFA
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-xs">Pack ({qtyPack})</div>
                          <div>
                            {formatPrice(prixPack)} FCFA
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold text-xs">Boite ({qtyBoite})</div>
                          <div>
                            {formatPrice(prixBoite)} FCFA
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
                            checked={currentInCatalogue}
                            onChange={() => handleToggleCatalogue(produit.sku, !currentInCatalogue)}
                            className="sr-only peer"
                          />
                          <div className={`relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 ${
                            'inCatalogue' in changes ? 'ring-2 ring-orange-400' : ''
                          }`}></div>
                          <span className="text-xs font-medium mt-1">
                            {currentInCatalogue ? 'Visible' : 'Masque'}
                          </span>
                        </label>
                      </td>

                      <td className="px-3 py-3">
                        <label className="flex flex-col items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentCoupDeCoeur}
                            onChange={() => handleToggleCoupDeCoeur(produit.sku, !currentCoupDeCoeur)}
                            className="sr-only peer"
                          />
                          <div className={`relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500 ${
                            'coupDeCoeur' in changes ? 'ring-2 ring-orange-400' : ''
                          }`}></div>
                          <span className="text-2xl mt-1">
                            {currentCoupDeCoeur ? '\u2764\uFE0F' : '\u{1F90D}'}
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

      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50 md:left-64 transition-transform duration-200 ${
          pendingCount > 0 ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">
              {pendingCount} modification{pendingCount > 1 ? 's' : ''} en attente
            </span>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={discardChanges}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
            <button
              onClick={saveAllChanges}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Sauvegarde...' : 'Sauvegarder tout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManager;
