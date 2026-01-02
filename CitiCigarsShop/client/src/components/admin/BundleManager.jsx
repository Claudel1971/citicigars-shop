import React, { useState, useEffect, useMemo } from 'react';
import apiService from '@/services/apiService';
import { 
  Search, Loader2, Package, Save, X, AlertCircle, Plus, Trash2, 
  Edit3, Eye, EyeOff, ChevronDown, ChevronUp 
} from 'lucide-react';
import { toast } from 'sonner';

const BundleManager = () => {
  const [bundles, setBundles] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedBundle, setExpandedBundle] = useState(null);
  const [editingBundle, setEditingBundle] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingBundle, setCreatingBundle] = useState(false);
  const [search, setSearch] = useState('');

  const [newBundle, setNewBundle] = useState({
    sku: '',
    nom: '',
    description: '',
    prixBundle: 0,
    promo: 0,
    imageUrl: '',
    items: []
  });

  const [editData, setEditData] = useState({
    nom: '',
    description: '',
    prixBundle: 0,
    promo: 0,
    imageUrl: '',
    items: []
  });

  useEffect(() => {
    fetchBundles();
    fetchProducts();
  }, []);

  const fetchBundles = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/bundles');
      console.log('Bundles API response:', response);
      const data = response.data;
      setBundles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching bundles:', error);
      toast.error('Erreur lors du chargement des bundles');
      setBundles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiService.get('/admin/bundles/products');
      const data = response.data;
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const filteredBundles = useMemo(() => {
    if (!Array.isArray(bundles)) return [];
    if (!search.trim()) return bundles;
    const searchLower = search.toLowerCase();
    return bundles.filter(b => 
      b.sku?.toLowerCase().includes(searchLower) ||
      b.nom?.toLowerCase().includes(searchLower) ||
      b.description?.toLowerCase().includes(searchLower)
    );
  }, [bundles, search]);

  const handleToggleExpand = (sku) => {
    setExpandedBundle(expandedBundle === sku ? null : sku);
  };

  const handleStartEdit = (bundle) => {
    setEditingBundle(bundle.sku);
    setEditData({
      nom: bundle.nom || '',
      description: bundle.description || '',
      prixBundle: bundle.prixBundle || 0,
      promo: bundle.promo || 0,
      imageUrl: bundle.imageUrl || '',
      items: bundle.items?.map(item => ({
        productSku: item.productSku,
        quantite: item.quantite,
        marque: item.marque,
        modele: item.modele,
        rating: item.rating,
        top25: item.top25
      })) || []
    });
  };

  const handleCancelEdit = () => {
    setEditingBundle(null);
    setEditData({ nom: '', description: '', prixBundle: 0, promo: 0, imageUrl: '', items: [] });
  };

  const handleSaveEdit = async (sku) => {
    try {
      setSaving(true);
      await apiService.put(`/bundles/${sku}`, {
        bundleData: {
          nom: editData.nom,
          description: editData.description,
          prixBundle: editData.prixBundle,
          promo: editData.promo || null,
          imageUrl: editData.imageUrl || null
        },
        items: editData.items
      });
      toast.success('Bundle mis a jour');
      handleCancelEdit();
      fetchBundles();
    } catch (error) {
      console.error('Error updating bundle:', error);
      toast.error('Erreur lors de la mise a jour');
    } finally {
      setSaving(false);
    }
  };

  const handleAvailabilityChange = async (sku, newStatus) => {
    try {
      await apiService.put(`/bundles/${sku}/availability`, {
        availabilityStatus: newStatus,
        soldOutAt: newStatus === 'SOLD_OUT' ? new Date().toISOString() : null
      });
      toast.success(`Statut mis a jour: ${newStatus}`);
      fetchBundles();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Erreur lors de la mise a jour du statut');
    }
  };

  const handleDeleteBundle = async (sku) => {
    if (!confirm(`Supprimer le bundle ${sku} ?`)) return;
    
    try {
      await apiService.delete(`/bundles/${sku}`);
      toast.success('Bundle supprime');
      fetchBundles();
    } catch (error) {
      console.error('Error deleting bundle:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCreateBundle = async () => {
    if (!newBundle.sku || !newBundle.nom) {
      toast.error('SKU et nom sont requis');
      return;
    }

    try {
      setCreatingBundle(true);
      await apiService.post('/bundles', {
        bundleData: {
          sku: newBundle.sku,
          nom: newBundle.nom,
          description: newBundle.description,
          prixBundle: newBundle.prixBundle,
          promo: newBundle.promo || null,
          imageUrl: newBundle.imageUrl || null
        },
        items: newBundle.items
      });
      toast.success('Bundle cree avec succes');
      setShowCreateModal(false);
      setNewBundle({ sku: '', nom: '', description: '', prixBundle: 0, promo: 0, imageUrl: '', items: [] });
      fetchBundles();
    } catch (error) {
      console.error('Error creating bundle:', error);
      toast.error('Erreur lors de la creation');
    } finally {
      setCreatingBundle(false);
    }
  };

  const addItemToBundle = (isNew = false) => {
    const target = isNew ? newBundle : editData;
    const setter = isNew ? setNewBundle : setEditData;
    
    setter({
      ...target,
      items: [...target.items, { productSku: '', quantite: 1, marque: '', modele: '', rating: '', top25: '' }]
    });
  };

  const removeItemFromBundle = (index, isNew = false) => {
    const target = isNew ? newBundle : editData;
    const setter = isNew ? setNewBundle : setEditData;
    
    setter({
      ...target,
      items: target.items.filter((_, i) => i !== index)
    });
  };

  const updateBundleItem = (index, field, value, isNew = false) => {
    const target = isNew ? newBundle : editData;
    const setter = isNew ? setNewBundle : setEditData;
    
    const updatedItems = [...target.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'productSku' && value) {
      const product = products.find(p => p.sku === value);
      if (product) {
        updatedItems[index].marque = product.marque;
        updatedItems[index].modele = product.modele || product.ligne;
      }
    }
    
    setter({ ...target, items: updatedItems });
  };

  const formatPrice = (price) => {
    if (!price) return '0 FCFA';
    return price.toLocaleString('fr-FR') + ' FCFA';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SOLD_OUT':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">SOLD OUT</span>;
      case 'PRE_ORDER':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">PRE-ORDER</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">EN STOCK</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-2 text-gray-600">Chargement des bundles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Bundles</h2>
          <p className="text-sm text-gray-500 mt-1">Packs Maison CitiCigars - {bundles.length} bundle(s)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau Bundle
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par SKU, nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      <div className="space-y-4">
        {filteredBundles.map((bundle) => (
          <div key={bundle.sku} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {bundle.imageUrl && (
                  <img 
                    src={bundle.imageUrl} 
                    alt={bundle.nom} 
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{bundle.sku}</span>
                    {getStatusBadge(bundle.availabilityStatus)}
                  </div>
                  <h3 className="font-semibold text-gray-900">{bundle.nom}</h3>
                  <p className="text-sm text-gray-500">{bundle.items?.length || 0} cigare(s)</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold text-amber-700">{formatPrice(bundle.prixBundle)}</div>
                  {bundle.promo > 0 && (
                    <span className="text-xs text-green-600">-{bundle.promo}%</span>
                  )}
                </div>

                <select
                  value={bundle.availabilityStatus || 'IN_STOCK'}
                  onChange={(e) => handleAvailabilityChange(bundle.sku, e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="IN_STOCK">En stock</option>
                  <option value="SOLD_OUT">Sold out</option>
                  <option value="PRE_ORDER">Pre-order</option>
                </select>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(bundle)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleExpand(bundle.sku)}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Voir composition"
                  >
                    {expandedBundle === bundle.sku ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDeleteBundle(bundle.sku)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {expandedBundle === bundle.sku && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <h4 className="font-medium text-gray-700 mb-3">Composition du bundle</h4>
                {bundle.description && (
                  <p className="text-sm text-gray-600 mb-3 italic">{bundle.description}</p>
                )}
                <div className="space-y-2">
                  {bundle.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-400">{item.productSku}</span>
                        <span className="font-medium">{item.marque} {item.modele}</span>
                        {item.rating && <span className="text-xs text-amber-600">{item.rating}</span>}
                        {item.top25 && <span className="text-xs text-purple-600">{item.top25}</span>}
                      </div>
                      <span className="text-sm text-gray-500">x{item.quantite}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editingBundle === bundle.sku && (
              <div className="border-t border-gray-200 p-4 bg-amber-50">
                <h4 className="font-medium text-gray-700 mb-4">Modifier le bundle</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input
                      type="text"
                      value={editData.nom}
                      onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA)</label>
                    <input
                      type="number"
                      value={editData.prixBundle}
                      onChange={(e) => setEditData({ ...editData, prixBundle: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Promo (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editData.promo || ''}
                      onChange={(e) => setEditData({ ...editData, promo: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL Image</label>
                    <input
                      type="text"
                      value={editData.imageUrl || ''}
                      onChange={(e) => setEditData({ ...editData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Composition</label>
                    <button
                      onClick={() => addItemToBundle(false)}
                      className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Ajouter cigare
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editData.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <select
                          value={item.productSku || ''}
                          onChange={(e) => updateBundleItem(idx, 'productSku', e.target.value, false)}
                          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">Selectionner un produit</option>
                          {products.map(p => (
                            <option key={p.sku} value={p.sku}>
                              {p.sku} - {p.marque} {p.ligne || p.modele}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={item.quantite}
                          onChange={(e) => updateBundleItem(idx, 'quantite', parseInt(e.target.value) || 1, false)}
                          className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
                        />
                        <input
                          type="text"
                          value={item.rating || ''}
                          onChange={(e) => updateBundleItem(idx, 'rating', e.target.value, false)}
                          placeholder="Rating"
                          className="w-24 text-sm border border-gray-300 rounded px-2 py-1"
                        />
                        <input
                          type="text"
                          value={item.top25 || ''}
                          onChange={(e) => updateBundleItem(idx, 'top25', e.target.value, false)}
                          placeholder="Top 25"
                          className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
                        />
                        <button
                          onClick={() => removeItemFromBundle(idx, false)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleSaveEdit(bundle.sku)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredBundles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun bundle trouve</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Creer un nouveau bundle</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={newBundle.sku}
                    onChange={(e) => setNewBundle({ ...newBundle, sku: e.target.value.toUpperCase() })}
                    placeholder="CTGBDL006"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={newBundle.nom}
                    onChange={(e) => setNewBundle({ ...newBundle, nom: e.target.value })}
                    placeholder="Marque, Nom du bundle"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA) *</label>
                  <input
                    type="number"
                    value={newBundle.prixBundle}
                    onChange={(e) => setNewBundle({ ...newBundle, prixBundle: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promo (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newBundle.promo || ''}
                    onChange={(e) => setNewBundle({ ...newBundle, promo: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newBundle.description}
                  onChange={(e) => setNewBundle({ ...newBundle, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Image</label>
                <input
                  type="text"
                  value={newBundle.imageUrl}
                  onChange={(e) => setNewBundle({ ...newBundle, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Composition du bundle</label>
                  <button
                    onClick={() => addItemToBundle(true)}
                    className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter cigare
                  </button>
                </div>
                <div className="space-y-2">
                  {newBundle.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                      <select
                        value={item.productSku || ''}
                        onChange={(e) => updateBundleItem(idx, 'productSku', e.target.value, true)}
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Selectionner un produit</option>
                        {products.map(p => (
                          <option key={p.sku} value={p.sku}>
                            {p.sku} - {p.marque} {p.ligne || p.modele}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantite}
                        onChange={(e) => updateBundleItem(idx, 'quantite', parseInt(e.target.value) || 1, true)}
                        className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
                        placeholder="Qte"
                      />
                      <input
                        type="text"
                        value={item.rating || ''}
                        onChange={(e) => updateBundleItem(idx, 'rating', e.target.value, true)}
                        placeholder="Rating"
                        className="w-24 text-sm border border-gray-300 rounded px-2 py-1"
                      />
                      <button
                        onClick={() => removeItemFromBundle(idx, true)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {newBundle.items.length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-4">
                      Aucun cigare ajoute. Cliquez sur "Ajouter cigare" pour composer le bundle.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateBundle}
                disabled={creatingBundle || !newBundle.sku || !newBundle.nom}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {creatingBundle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Creer le bundle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundleManager;
