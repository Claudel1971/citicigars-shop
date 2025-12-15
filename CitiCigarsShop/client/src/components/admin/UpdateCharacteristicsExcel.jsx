import React, { useState } from 'react';
import { useProducts } from '@/context/ProductContext';
import { API_URL } from '@/config';
import { Save, Upload, Download, Loader2, Check, X } from 'lucide-react';

const UpdateCharacteristicsExcel = () => {
  const { products, setProducts } = useProducts();
  const [editedProducts, setEditedProducts] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [filter, setFilter] = useState('');

  const catalogueProducts = products.filter(p => p.inCatalogue !== false);
  
  const filteredProducts = catalogueProducts.filter(p => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.sku?.toLowerCase().includes(q) ||
      p.marque?.toLowerCase().includes(q) ||
      p.modele?.toLowerCase().includes(q) ||
      p.vitole?.toLowerCase().includes(q)
    );
  });

  const handleChange = (sku, field, value) => {
    setEditedProducts(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [field]: value
      }
    }));
  };

  const getValue = (product, field) => {
    if (editedProducts[product.sku] && editedProducts[product.sku][field] !== undefined) {
      return editedProducts[product.sku][field];
    }
    return product[field] || '';
  };

  const hasChanges = (sku) => {
    return editedProducts[sku] && Object.keys(editedProducts[sku]).length > 0;
  };

  const saveChanges = async () => {
    const skusToUpdate = Object.keys(editedProducts);
    if (skusToUpdate.length === 0) {
      setMessage({ type: 'info', text: 'Aucune modification à sauvegarder' });
      return;
    }

    setSaving(true);
    setMessage(null);
    let successCount = 0;
    let errorCount = 0;

    for (const sku of skusToUpdate) {
      try {
        const response = await fetch(`${API_URL}/api/products/${sku}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedProducts[sku])
        });
        
        if (response.ok) {
          successCount++;
          setProducts(prev => prev.map(p => 
            p.sku === sku ? { ...p, ...editedProducts[sku] } : p
          ));
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    setSaving(false);
    setEditedProducts({});
    
    if (errorCount === 0) {
      setMessage({ type: 'success', text: `${successCount} produit(s) mis à jour avec succès` });
    } else {
      setMessage({ type: 'error', text: `${successCount} succès, ${errorCount} erreur(s)` });
    }
  };

  const exportCSV = () => {
    const headers = ['SKU', 'Marque', 'Ligne', 'Modèle', 'Vitole', 'Format', 'Pays', 'Puissance', 'Qté Boîte'];
    const rows = catalogueProducts.map(p => [
      p.sku,
      p.marque || '',
      p.ligne || '',
      p.modele || '',
      p.vitole || '',
      p.format || '',
      p.pays || '',
      p.puissance || '',
      p.qteBoite || ''
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produits_caracteristiques.csv';
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Modifier les caractéristiques</h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || Object.keys(editedProducts).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder ({Object.keys(editedProducts).length})
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' :
          message.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Filtrer par SKU, marque, modèle..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <span className="text-sm text-gray-500">
          {filteredProducts.length} produit(s)
        </span>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">SKU</th>
              <th className="px-3 py-2 text-left font-medium">Marque</th>
              <th className="px-3 py-2 text-left font-medium">Ligne</th>
              <th className="px-3 py-2 text-left font-medium">Modèle</th>
              <th className="px-3 py-2 text-left font-medium">Vitole</th>
              <th className="px-3 py-2 text-left font-medium">Format</th>
              <th className="px-3 py-2 text-left font-medium">Pays</th>
              <th className="px-3 py-2 text-left font-medium w-20">Puissance</th>
              <th className="px-3 py-2 text-left font-medium w-20">Qté Boîte</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredProducts.map((product) => (
              <tr key={product.sku} className={hasChanges(product.sku) ? 'bg-yellow-50' : ''}>
                <td className="px-3 py-2 font-mono text-xs">{product.sku}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={getValue(product, 'marque')}
                    onChange={(e) => handleChange(product.sku, 'marque', e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={getValue(product, 'ligne')}
                    onChange={(e) => handleChange(product.sku, 'ligne', e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={getValue(product, 'modele')}
                    onChange={(e) => handleChange(product.sku, 'modele', e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={getValue(product, 'vitole')}
                    onChange={(e) => handleChange(product.sku, 'vitole', e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={getValue(product, 'format')}
                    onChange={(e) => handleChange(product.sku, 'format', e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={getValue(product, 'pays')}
                    onChange={(e) => handleChange(product.sku, 'pays', e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">--</option>
                    <option value="Cuba">Cuba</option>
                    <option value="Nicaragua">Nicaragua</option>
                    <option value="Honduras">Honduras</option>
                    <option value="République Dominicaine">Rép. Dominicaine</option>
                    <option value="Mexique">Mexique</option>
                    <option value="Costa Rica">Costa Rica</option>
                    <option value="Équateur">Équateur</option>
                    <option value="Brésil">Brésil</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={getValue(product, 'puissance')}
                    onChange={(e) => handleChange(product.sku, 'puissance', parseInt(e.target.value) || '')}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">--</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={getValue(product, 'qteBoite')}
                    onChange={(e) => handleChange(product.sku, 'qteBoite', parseInt(e.target.value) || '')}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  {hasChanges(product.sku) && (
                    <span className="text-yellow-600" title="Modifié">●</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UpdateCharacteristicsExcel;
