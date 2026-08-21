import React, { useEffect, useMemo, useState } from 'react';
import { crmFetch } from './crmApi';
import { API_URL } from '@/config';

const fmtXaf = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('fr-FR'));
const fmtPct = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `${(Number(n) * 100).toFixed(1)} %`);

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

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date || b instanceof Date) {
    return new Date(a).getTime() - new Date(b).getTime();
  }

  const aNum = typeof a === 'number' ? a : Number(a);
  const bNum = typeof b === 'number' ? b : Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && String(a).trim() !== '' && String(b).trim() !== '') {
    return aNum - bNum;
  }

  return String(a).localeCompare(String(b), 'fr', { sensitivity: 'base', numeric: true });
}

function SortableHeader({ label, sortKey, sortState, onSort, className = '' }) {
  const active = sortState.key === sortKey;
  const arrow = active ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th className={`p-2 whitespace-nowrap ${className}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="font-semibold hover:underline">
        {label}{arrow}
      </button>
    </th>
  );
}

function lineMarginXaf(row) {
  if (row.actualLineCostXaf == null || row.actualLineCostXaf === '') return null;
  return Number(row.actualLineRevenueXaf || 0) - Number(row.actualLineCostXaf);
}

const TransactionExplorer = () => {
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [newViewName, setNewViewName] = useState('');
  const [viewMode, setViewMode] = useState('orders');
  const [expandedOrders, setExpandedOrders] = useState(() => new Set());
  const [orderSort, setOrderSort] = useState({ key: 'orderDate', direction: 'desc' });
  const [lineSort, setLineSort] = useState({ key: 'orderDate', direction: 'desc' });

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
      setExpandedOrders(new Set());
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
        body: JSON.stringify({ ...cleanFilters(filters), viewMode }),
      });
      if (!res.ok) throw new Error("Échec de l'export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const grain = viewMode === 'orders' ? 'commandes' : 'lignes';
      a.download = `citicigars-${grain}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const orderRows = useMemo(() => {
    const grouped = new Map();

    for (const row of rows) {
      let order = grouped.get(row.orderId);
      if (!order) {
        order = {
          orderId: row.orderId,
          orderDate: row.orderDate,
          customerId: row.customerId,
          customerName: row.customerName,
          finalSaleTotalXaf: Number(row.finalSaleTotalXaf || 0),
          amountPaid: Number(row.amountPaid || 0),
          balanceDue: Number(row.balanceDue || 0),
          paymentStatus: row.paymentStatus,
          lineCount: 0,
          itemQuantity: 0,
          revenueFromVisibleLines: 0,
          rawCostTotal: 0,
          costsComplete: true,
          lines: [],
        };
        grouped.set(row.orderId, order);
      }

      order.lineCount += 1;
      order.itemQuantity += Number(row.quantity || 0);
      order.revenueFromVisibleLines += Number(row.actualLineRevenueXaf || 0);
      if (row.actualLineCostXaf == null || row.actualLineCostXaf === '') {
        order.costsComplete = false;
      } else {
        order.rawCostTotal += Number(row.actualLineCostXaf);
      }
      order.lines.push(row);
    }

    return Array.from(grouped.values()).map((order) => {
      const revenueComplete = order.revenueFromVisibleLines === order.finalSaleTotalXaf;
      const orderCostXaf = order.costsComplete && revenueComplete ? order.rawCostTotal : null;
      const marginXaf = orderCostXaf == null ? null : order.finalSaleTotalXaf - orderCostXaf;
      const marginRate =
        marginXaf == null || order.finalSaleTotalXaf === 0
          ? null
          : marginXaf / order.finalSaleTotalXaf;

      return { ...order, orderCostXaf, marginXaf, marginRate };
    });
  }, [rows]);

  const sortedOrders = useMemo(() => {
    const copy = [...orderRows];
    copy.sort((a, b) => {
      const cmp = compareValues(a[orderSort.key], b[orderSort.key]);
      return orderSort.direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [orderRows, orderSort]);

  const sortedLines = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av = a[lineSort.key];
      let bv = b[lineSort.key];
      if (lineSort.key === 'lineMarginXaf') {
        av = lineMarginXaf(a);
        bv = lineMarginXaf(b);
      }
      const cmp = compareValues(av, bv);
      return lineSort.direction === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, lineSort]);

  const toggleSort = (mode, key) => {
    const setter = mode === 'orders' ? setOrderSort : setLineSort;
    setter((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleOrder = (orderId) => {
    setExpandedOrders((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
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
          <input type="date" value={filters.dateFrom} onChange={(e) => setField('dateFrom', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />
          <input type="date" value={filters.dateTo} onChange={(e) => setField('dateTo', e.target.value)} className="border rounded-md px-2 py-1.5 text-sm" />

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
            Exporter {viewMode === 'orders' ? 'les commandes' : 'les lignes'} (.xlsx)
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

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setViewMode('orders')}
          className={`px-4 py-2 rounded-md text-sm ${viewMode === 'orders' ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          Commandes ({orderRows.length})
        </button>
        <button
          type="button"
          onClick={() => setViewMode('lines')}
          className={`px-4 py-2 rounded-md text-sm ${viewMode === 'lines' ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          Lignes ({rows.length})
        </button>
      </div>

      {viewMode === 'orders' ? (
        <div className="overflow-x-auto bg-white border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 w-8"></th>
                <SortableHeader label="SALE ID" sortKey="orderId" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Date" sortKey="orderDate" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Client" sortKey="customerName" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Lignes" sortKey="lineCount" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Qté" sortKey="itemQuantity" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Net commande" sortKey="finalSaleTotalXaf" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Payé" sortKey="amountPaid" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Balance" sortKey="balanceDue" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Statut" sortKey="paymentStatus" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Coût commande" sortKey="orderCostXaf" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Marge XAF" sortKey="marginXaf" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
                <SortableHeader label="Marge %" sortKey="marginRate" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} />
              </tr>
            </thead>
            <tbody>
              {sortedOrders.slice(0, 200).map((order) => {
                const expanded = expandedOrders.has(order.orderId);
                return (
                  <React.Fragment key={order.orderId}>
                    <tr className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => toggleOrder(order.orderId)}
                          aria-label={expanded ? 'Fermer le détail' : 'Voir le détail'}
                          className="w-6 h-6 rounded hover:bg-gray-200"
                        >
                          {expanded ? '⌄' : '›'}
                        </button>
                      </td>
                      <td className="p-2 whitespace-nowrap">{order.orderId}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(order.orderDate).toLocaleDateString('fr-FR')}</td>
                      <td className="p-2">{order.customerName}</td>
                      <td className="p-2 text-right">{order.lineCount}</td>
                      <td className="p-2 text-right">{order.itemQuantity}</td>
                      <td className="p-2 text-right whitespace-nowrap">{fmtXaf(order.finalSaleTotalXaf)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{fmtXaf(order.amountPaid)}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {order.balanceDue > 0 ? <span className="text-red-600">{fmtXaf(order.balanceDue)}</span> : '—'}
                      </td>
                      <td className="p-2 whitespace-nowrap">{order.paymentStatus}</td>
                      <td className="p-2 text-right whitespace-nowrap">{fmtXaf(order.orderCostXaf)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{fmtXaf(order.marginXaf)}</td>
                      <td className="p-2 text-right whitespace-nowrap">{fmtPct(order.marginRate)}</td>
                    </tr>

                    {expanded && (
                      <tr className="border-t bg-gray-50/60">
                        <td></td>
                        <td colSpan={12} className="p-3">
                          <div className="font-semibold mb-2">Détail commande {order.orderId}</div>
                          <div className="overflow-x-auto border rounded bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-left">
                                <tr>
                                  <th className="p-2">SKU</th>
                                  <th className="p-2">Marque</th>
                                  <th className="p-2">Série</th>
                                  <th className="p-2">Vitole</th>
                                  <th className="p-2">Type</th>
                                  <th className="p-2 text-right">Qté</th>
                                  <th className="p-2 text-right">CA ligne</th>
                                  <th className="p-2 text-right">Coût réel</th>
                                  <th className="p-2 text-right">Marge ligne</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.lines.map((line) => (
                                  <tr key={line.orderItemId} className="border-t">
                                    <td className="p-2">{line.itemSku}</td>
                                    <td className="p-2">{line.brand || '—'}</td>
                                    <td className="p-2">{line.series || '—'}</td>
                                    <td className="p-2">{line.vitole || '—'}</td>
                                    <td className="p-2">{line.itemType}</td>
                                    <td className="p-2 text-right">{line.quantity}</td>
                                    <td className="p-2 text-right">{fmtXaf(line.actualLineRevenueXaf)}</td>
                                    <td className="p-2 text-right">{fmtXaf(line.actualLineCostXaf)}</td>
                                    <td className="p-2 text-right">{fmtXaf(lineMarginXaf(line))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {orderRows.length > 200 && (
            <p className="p-3 text-xs text-gray-400">Aperçu limité à 200 commandes — l'export contient toutes les commandes filtrées.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left">
              <tr>
                <SortableHeader label="SALE ID" sortKey="orderId" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Date" sortKey="orderDate" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Client" sortKey="customerName" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="SKU" sortKey="itemSku" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Marque" sortKey="brand" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Série" sortKey="series" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Vitole" sortKey="vitole" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Type" sortKey="itemType" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Qté" sortKey="quantity" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="CA ligne" sortKey="actualLineRevenueXaf" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Coût réel" sortKey="actualLineCostXaf" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
                <SortableHeader label="Marge ligne" sortKey="lineMarginXaf" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} />
              </tr>
            </thead>
            <tbody>
              {sortedLines.slice(0, 200).map((r) => (
                <tr key={r.orderItemId} className="border-t">
                  <td className="p-2 whitespace-nowrap">{r.orderId}</td>
                  <td className="p-2 whitespace-nowrap">{new Date(r.orderDate).toLocaleDateString('fr-FR')}</td>
                  <td className="p-2">{r.customerName}</td>
                  <td className="p-2">{r.itemSku}</td>
                  <td className="p-2">{r.brand || '—'}</td>
                  <td className="p-2">{r.series || '—'}</td>
                  <td className="p-2">{r.vitole || '—'}</td>
                  <td className="p-2">{r.itemType}</td>
                  <td className="p-2 text-right">{r.quantity}</td>
                  <td className="p-2 text-right">{fmtXaf(r.actualLineRevenueXaf)}</td>
                  <td className="p-2 text-right">{fmtXaf(r.actualLineCostXaf)}</td>
                  <td className="p-2 text-right">{fmtXaf(lineMarginXaf(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p className="p-3 text-xs text-gray-400">Aperçu limité à 200 lignes — l'export contient toutes les lignes filtrées.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionExplorer;
