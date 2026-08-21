import React, { useEffect, useState } from 'react';
import { crmFetch } from './crmApi';
import { API_URL } from '@/config';

const fmtXaf = (n) => (n == null ? '' : Number(n).toLocaleString('fr-FR'));

const ITEM_TYPES = ['PRODUCT', 'BUNDLE', 'ACCESSORY', 'SERVICE', 'CUSTOM'];
const PAYMENT_STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'PAID', label: 'Payé' },
  { value: 'PARTIAL', label: 'Partiel' },
  { value: 'UNPAID', label: 'Non payé' },
];

const emptyFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  customerId: '',
  orderType: '',
  itemSku: '',
  itemType: '',
  city: '',
  country: '',
  paymentStatus: '',
  minAmountXaf: '',
  maxAmountXaf: '',
  hasDiscount: false,
  minMarginRate: '',
  maxMarginRate: '',
  hasCostVariance: false,
  hasSrvVal: false,
};

// Only send filter keys that are actually set — an empty string/false is
// "no constraint", not "match empty". Numeric fields get coerced.
function cleanFilters(f) {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === '' || v === null || v === undefined) continue;
    if (v === false) continue;
    if (['minAmountXaf', 'maxAmountXaf'].includes(k)) out[k] = parseInt(v, 10);
    else if (['minMarginRate', 'maxMarginRate'].includes(k)) out[k] = parseFloat(v) / 100;
    else out[k] = v;
  }
  return out;
}

const TransactionExplorer = () => {
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [newViewName, setNewViewName] = useState('');

  const loadSavedViews = async () => {
    try {
      const res = await crmFetch('/api/crm/saved-views');
      if (res.ok) setSavedViews(await res.json());
    } catch {
      // non-blocking
    }
  };

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmFetch('/api/crm/transactions/search', {
        method: 'POST',
        body: JSON.stringify(cleanFilters(filters)),
      });
      if (!res.ok) throw new Error('Erreur de recherche');
      setRows(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedViews();
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const applyView = (view) => {
    setFilters({ ...emptyFilters, ...view.filters });
  };

  const saveCurrentView = async () => {
    if (!newViewName.trim()) return;
    try {
      const res = await crmFetch('/api/crm/saved-views', {
        method: 'POST',
        body: JSON.stringify({ name: newViewName, filters: cleanFilters(filters) }),
      });
      if (!res.ok) throw new Error('Échec de la sauvegarde');
      setNewViewName('');
      await loadSavedViews();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteView = async (id) => {
    if (!confirm('Supprimer cette vue ?')) return;
    await crmFetch(`/api/crm/saved-views/${id}`, { method: 'DELETE' });
    await loadSavedViews();
  };

  const exportXlsx = async () => {
    try {
      const token = sessionStorage.getItem('cms_token');
      const res = await fetch(`${API_URL}/api/crm/transactions/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cms-token': token || '' },
        body: JSON.stringify(cleanFilters(filters)),
      });
      if (!res.ok) throw new Error("Échec de l'export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citicigars-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-primary mb-1">Explorateur de transactions</h1>
      <p className="text-sm text-gray-500 mb-4">
        Filtre et exporte tes transactions vers Excel. Pas d'analyse ici — TCD et ratios restent dans Excel.
      </p>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {savedViews.map((v) => (
            <div key={v.savedViewId} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
              <button onClick={() => applyView(v)} className="hover:underline">{v.name}</button>
              <button onClick={() => deleteView(v.savedViewId)} className="text-gray-400 hover:text-red-600 ml-1">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border rounded-md p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Recherche (client, SALE ID, SKU...)" value={filters.search} onChange={(e) => setField('search', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm col-span-2" />
          <input type="date" placeholder="Du" value={filters.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <input type="date" placeholder="Au" value={filters.dateTo} onChange={(e) => setField('dateTo', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />

          <input placeholder="Customer ID" value={filters.customerId} onChange={(e) => setField('customerId', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <input placeholder="Relation commerciale / type" value={filters.orderType} onChange={(e) => setField('orderType', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <input placeholder="SKU" value={filters.itemSku} onChange={(e) => setField('itemSku', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <select value={filters.itemType} onChange={(e) => setField('itemType', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">Type d'item (tous)</option>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <input placeholder="Ville" value={filters.city} onChange={(e) => setField('city', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <input placeholder="Pays" value={filters.country} onChange={(e) => setField('country', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <select value={filters.paymentStatus} onChange={(e) => setField('paymentStatus', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm">
            {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label || 'Statut paiement'}</option>)}
          </select>
          <div className="flex gap-1">
            <input type="number" placeholder="Montant min" value={filters.minAmountXaf} onChange={(e) => setField('minAmountXaf', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            <input type="number" placeholder="Montant max" value={filters.maxAmountXaf} onChange={(e) => setField('maxAmountXaf', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
          </div>

          <div className="flex gap-1">
            <input type="number" placeholder="Marge min %" value={filters.minMarginRate} onChange={(e) => setField('minMarginRate', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            <input type="number" placeholder="Marge max %" value={filters.maxMarginRate} onChange={(e) => setField('maxMarginRate', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.hasDiscount} onChange={(e) => setField('hasDiscount', e.target.checked)} />
            Avec remise
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.hasCostVariance} onChange={(e) => setField('hasCostVariance', e.target.checked)} />
            Écart coût std/réel
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.hasSrvVal} onChange={(e) => setField('hasSrvVal', e.target.checked)} />
            CTCG-SRV-VAL présent
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={search} disabled={loading} className="bg-primary text-white px-4 py-2 rounded-md text-sm disabled:opacity-50">
            {loading ? 'Recherche...' : 'Rechercher'}
          </button>
          <button onClick={() => setFilters(emptyFilters)} className="bg-gray-100 px-4 py-2 rounded-md text-sm">
            Réinitialiser
          </button>
          <button onClick={exportXlsx} className="bg-green-700 text-white px-4 py-2 rounded-md text-sm ml-auto">
            Exporter la vue actuelle (.xlsx)
          </button>
        </div>

        <div className="flex gap-2 mt-3 border-t pt-3">
          <input
            placeholder="Nom de la vue à enregistrer..."
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm flex-1"
          />
          <button onClick={saveCurrentView} className="bg-gray-200 px-3 py-1.5 rounded-md text-sm">
            Enregistrer comme vue
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <p className="text-sm text-gray-500 mb-2">{rows.length} ligne(s)</p>

      <div className="overflow-x-auto bg-white border rounded-md">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">SALE ID</th>
              <th className="p-2">Date</th>
              <th className="p-2">Client</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Marque</th>
              <th className="p-2">Type</th>
              <th className="p-2">Qté</th>
              <th className="p-2">CA ligne</th>
              <th className="p-2">Coût réel</th>
              <th className="p-2">Net commande</th>
              <th className="p-2">Statut</th>
              <th className="p-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.orderItemId} className="border-t">
                <td className="p-2">{r.orderId}</td>
                <td className="p-2">{new Date(r.orderDate).toLocaleDateString('fr-FR')}</td>
                <td className="p-2">{r.customerName}</td>
                <td className="p-2">{r.itemSku}</td>
                <td className="p-2">{r.brand || '—'}</td>
                <td className="p-2">{r.itemType}</td>
                <td className="p-2">{r.quantity}</td>
                <td className="p-2">{fmtXaf(r.actualLineRevenueXaf)}</td>
                <td className="p-2">{fmtXaf(r.actualLineCostXaf)}</td>
                <td className="p-2">{fmtXaf(r.finalSaleTotalXaf)}</td>
                <td className="p-2">{r.paymentStatus}</td>
                <td className="p-2">{r.balanceDue > 0 ? <span className="text-red-600">{fmtXaf(r.balanceDue)}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 200 && (
          <p className="p-3 text-xs text-gray-400">Aperçu limité à 200 lignes — l'export contient toutes les {rows.length} lignes.</p>
        )}
      </div>
    </div>
  );
};

export default TransactionExplorer;
