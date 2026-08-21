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

function SortableHeader({
  label,
  sortKey,
  sortState,
  onSort,
  onResize,
  width,
  className = '',
}) {
  const active = sortState.key === sortKey;
  const arrow = active ? (sortState.direction === 'asc' ? ' ?' : ' ?') : '';

  return (
    <th
      className={`p-2 whitespace-nowrap relative ${className}`}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="font-semibold hover:underline"
      >
        {label}{arrow}
      </button>

      <span
        role="separator"
        onMouseDown={onResize}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-gray-200"
        title="Glisser pour ajuster la largeur"
      />
    </th>
  );
}

function lineMarginXaf(row) {
  if (row.actualLineCostXaf == null || row.actualLineCostXaf === '') return null;
  return Number(row.actualLineRevenueXaf || 0) - Number(row.actualLineCostXaf);
}


const ORDER_TABLE_COLUMNS = [
  { key: 'orderId', label: 'SALE ID', index: 2, width: 145 },
  { key: 'orderDate', label: 'Date', index: 3, width: 105 },
  { key: 'customerName', label: 'Client', index: 4, width: 180 },
  { key: 'lineCount', label: 'Lignes', index: 5, width: 80 },
  { key: 'itemQuantity', label: 'Qt?', index: 6, width: 70 },
  { key: 'finalSaleTotalXaf', label: 'Net commande', index: 7, width: 130 },
  { key: 'amountPaid', label: 'Pay?', index: 8, width: 115 },
  { key: 'balanceDue', label: 'Balance', index: 9, width: 115 },
  { key: 'paymentStatus', label: 'Statut', index: 10, width: 100 },
  { key: 'orderCostXaf', label: 'Coût commande', index: 11, width: 130 },
  { key: 'marginXaf', label: 'Marge XAF', index: 12, width: 120 },
  { key: 'marginRate', label: 'Marge %', index: 13, width: 100 },
];

const LINE_TABLE_COLUMNS = [
  { key: 'orderId', label: 'SALE ID', index: 1, width: 145 },
  { key: 'orderDate', label: 'Date', index: 2, width: 105 },
  { key: 'customerName', label: 'Client', index: 3, width: 180 },
  { key: 'itemSku', label: 'SKU', index: 4, width: 145 },
  { key: 'brand', label: 'Marque', index: 5, width: 120 },
  { key: 'series', label: 'Série', index: 6, width: 145 },
  { key: 'vitole', label: 'Vitole', index: 7, width: 120 },
  { key: 'itemType', label: 'Type', index: 8, width: 105 },
  { key: 'quantity', label: 'Qt?', index: 9, width: 70 },
  { key: 'actualLineRevenueXaf', label: 'CA ligne', index: 10, width: 115 },
  { key: 'actualLineCostXaf', label: 'Coût réel', index: 11, width: 115 },
  { key: 'lineMarginXaf', label: 'Marge ligne', index: 12, width: 115 },
];

const DEFAULT_TRANSACTION_WIDTHS = {
  orders: Object.fromEntries(ORDER_TABLE_COLUMNS.map((c) => [c.key, c.width])),
  lines: Object.fromEntries(LINE_TABLE_COLUMNS.map((c) => [c.key, c.width])),
};

const TRANSACTION_PREF_KEY = 'citicigars.crm.transactions.tablePrefs';

const loadTransactionPrefs = () => {
  const defaults = {
    fontSize: 'small',
    density: 'normal',
    hidden: { orders: [], lines: [] },
    widths: DEFAULT_TRANSACTION_WIDTHS,
  };

  try {
    const saved =
      JSON.parse(localStorage.getItem(TRANSACTION_PREF_KEY) || 'null') || {};

    return {
      ...defaults,
      ...saved,
      hidden: {
        orders: saved.hidden?.orders || [],
        lines: saved.hidden?.lines || [],
      },
      widths: {
        orders: {
          ...DEFAULT_TRANSACTION_WIDTHS.orders,
          ...(saved.widths?.orders || {}),
        },
        lines: {
          ...DEFAULT_TRANSACTION_WIDTHS.lines,
          ...(saved.widths?.lines || {}),
        },
      },
    };
  } catch {
    return defaults;
  }
};

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
  const [tablePrefs, setTablePrefs] = useState(loadTransactionPrefs);
  const [showDisplay, setShowDisplay] = useState(false);

  useEffect(() => {
    localStorage.setItem(TRANSACTION_PREF_KEY, JSON.stringify(tablePrefs));
  }, [tablePrefs]);

  const tableFontClass =
    tablePrefs.fontSize === 'small'
      ? 'text-xs'
      : tablePrefs.fontSize === 'large'
        ? 'text-sm'
        : 'text-[13px]';

  const tablePaddingClass =
    tablePrefs.density === 'compact'
      ? '[&_th]:py-1 [&_td]:py-1'
      : tablePrefs.density === 'comfortable'
        ? '[&_th]:py-3 [&_td]:py-3'
        : '[&_th]:py-2 [&_td]:py-2';

  const columnVisible = (mode, key) =>
    !(tablePrefs.hidden?.[mode] || []).includes(key);

  const toggleColumn = (mode, key) => {
    setTablePrefs((current) => {
      const hidden = current.hidden?.[mode] || [];
      return {
        ...current,
        hidden: {
          ...current.hidden,
          [mode]: hidden.includes(key)
            ? hidden.filter((x) => x !== key)
            : [...hidden, key],
        },
      };
    });
  };

  const columnWidth = (mode, key) =>
    tablePrefs.widths?.[mode]?.[key] ||
    DEFAULT_TRANSACTION_WIDTHS[mode][key];

  const startColumnResize = (event, mode, key) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidth(mode, key);

    const move = (e) => {
      const next = Math.max(65, startWidth + e.clientX - startX);
      setTablePrefs((current) => ({
        ...current,
        widths: {
          ...current.widths,
          [mode]: {
            ...current.widths?.[mode],
            [key]: next,
          },
        },
      }));
    };

    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  const currentColumns =
    viewMode === 'orders' ? ORDER_TABLE_COLUMNS : LINE_TABLE_COLUMNS;

  const tableColumnCss = [
    ...ORDER_TABLE_COLUMNS.map((c) => {
      const width = columnWidth('orders', c.key);
      const display = columnVisible('orders', c.key) ? '' : 'display:none;';
      return `
        .crm-orders-table > thead > tr > th:nth-child(${c.index}),
        .crm-orders-table > tbody > tr.crm-order-summary > td:nth-child(${c.index}) {
          width:${width}px;
          min-width:${width}px;
          max-width:${width}px;
          ${display}
        }
      `;
    }),
    ...LINE_TABLE_COLUMNS.map((c) => {
      const width = columnWidth('lines', c.key);
      const display = columnVisible('lines', c.key) ? '' : 'display:none;';
      return `
        .crm-lines-table > thead > tr > th:nth-child(${c.index}),
        .crm-lines-table > tbody > tr > td:nth-child(${c.index}) {
          width:${width}px;
          min-width:${width}px;
          max-width:${width}px;
          ${display}
        }
      `;
    }),
  ].join('\n');

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
      <style>{tableColumnCss}</style>
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

      <div className="flex flex-wrap items-center gap-2 mb-3">
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

        <button
          type="button"
          onClick={() => setShowDisplay((v) => !v)}
          className="ml-auto border bg-white px-4 py-2 rounded-md text-sm"
        >
          Affichage
        </button>
      </div>

      {showDisplay && (
        <div className="mb-4 rounded-md border bg-white p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="block mb-1 font-medium">Taille du texte</span>
              <select
                value={tablePrefs.fontSize}
                onChange={(e) =>
                  setTablePrefs((p) => ({ ...p, fontSize: e.target.value }))
                }
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="small">Petit</option>
                <option value="normal">Normal</option>
                <option value="large">Grand</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="block mb-1 font-medium">Densit? des lignes</span>
              <select
                value={tablePrefs.density}
                onChange={(e) =>
                  setTablePrefs((p) => ({ ...p, density: e.target.value }))
                }
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="comfortable">Confortable</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setTablePrefs({
                    fontSize: 'small',
                    density: 'normal',
                    hidden: { orders: [], lines: [] },
                    widths: DEFAULT_TRANSACTION_WIDTHS,
                  })
                }
                className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm"
              >
                Réinitialiser l'affichage
              </button>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="mb-2 text-sm font-medium">
              Colonnes visibles ? {viewMode === 'orders' ? 'Commandes' : 'Lignes'}
            </div>

            <div className="flex flex-wrap gap-3">
              {currentColumns.map((column) => (
                <label key={column.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisible(viewMode, column.key)}
                    onChange={() => toggleColumn(viewMode, column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Les préférences sont mémorisées sur ce navigateur. La largeur se règle en glissant le bord droit des en-têtes.
          </p>
        </div>
      )}

      {viewMode === 'orders' ? (
        <div className="overflow-x-auto bg-white border rounded-md">
          <table className={`crm-orders-table w-full table-fixed ${tableFontClass} ${tablePaddingClass}`}>
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2 w-8"></th>
                <SortableHeader label="SALE ID" sortKey="orderId" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'orderId')} onResize={(e) => startColumnResize(e, 'orders', 'orderId')} />
                <SortableHeader label="Date" sortKey="orderDate" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'orderDate')} onResize={(e) => startColumnResize(e, 'orders', 'orderDate')} />
                <SortableHeader label="Client" sortKey="customerName" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'customerName')} onResize={(e) => startColumnResize(e, 'orders', 'customerName')} />
                <SortableHeader label="Lignes" sortKey="lineCount" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'lineCount')} onResize={(e) => startColumnResize(e, 'orders', 'lineCount')} />
                <SortableHeader label="Qté" sortKey="itemQuantity" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'itemQuantity')} onResize={(e) => startColumnResize(e, 'orders', 'itemQuantity')} />
                <SortableHeader label="Net commande" sortKey="finalSaleTotalXaf" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'finalSaleTotalXaf')} onResize={(e) => startColumnResize(e, 'orders', 'finalSaleTotalXaf')} />
                <SortableHeader label="Payé" sortKey="amountPaid" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'amountPaid')} onResize={(e) => startColumnResize(e, 'orders', 'amountPaid')} />
                <SortableHeader label="Balance" sortKey="balanceDue" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'balanceDue')} onResize={(e) => startColumnResize(e, 'orders', 'balanceDue')} />
                <SortableHeader label="Statut" sortKey="paymentStatus" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'paymentStatus')} onResize={(e) => startColumnResize(e, 'orders', 'paymentStatus')} />
                <SortableHeader label="Coût commande" sortKey="orderCostXaf" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'orderCostXaf')} onResize={(e) => startColumnResize(e, 'orders', 'orderCostXaf')} />
                <SortableHeader label="Marge XAF" sortKey="marginXaf" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'marginXaf')} onResize={(e) => startColumnResize(e, 'orders', 'marginXaf')} />
                <SortableHeader label="Marge %" sortKey="marginRate" sortState={orderSort} onSort={(k) => toggleSort('orders', k)} width={columnWidth('orders', 'marginRate')} onResize={(e) => startColumnResize(e, 'orders', 'marginRate')} />
              </tr>
            </thead>
            <tbody>
              {sortedOrders.slice(0, 200).map((order) => {
                const expanded = expandedOrders.has(order.orderId);
                return (
                  <React.Fragment key={order.orderId}>
                    <tr className="crm-order-summary border-t hover:bg-gray-50">
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
                            <table className={`w-full ${tableFontClass} ${tablePaddingClass}`}>
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
          <table className={`crm-lines-table w-full table-fixed ${tableFontClass} ${tablePaddingClass}`}>
            <thead className="bg-gray-50 text-left">
              <tr>
                <SortableHeader label="SALE ID" sortKey="orderId" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'orderId')} onResize={(e) => startColumnResize(e, 'lines', 'orderId')} />
                <SortableHeader label="Date" sortKey="orderDate" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'orderDate')} onResize={(e) => startColumnResize(e, 'lines', 'orderDate')} />
                <SortableHeader label="Client" sortKey="customerName" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'customerName')} onResize={(e) => startColumnResize(e, 'lines', 'customerName')} />
                <SortableHeader label="SKU" sortKey="itemSku" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'itemSku')} onResize={(e) => startColumnResize(e, 'lines', 'itemSku')} />
                <SortableHeader label="Marque" sortKey="brand" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'brand')} onResize={(e) => startColumnResize(e, 'lines', 'brand')} />
                <SortableHeader label="Série" sortKey="series" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'series')} onResize={(e) => startColumnResize(e, 'lines', 'series')} />
                <SortableHeader label="Vitole" sortKey="vitole" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'vitole')} onResize={(e) => startColumnResize(e, 'lines', 'vitole')} />
                <SortableHeader label="Type" sortKey="itemType" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'itemType')} onResize={(e) => startColumnResize(e, 'lines', 'itemType')} />
                <SortableHeader label="Qté" sortKey="quantity" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'quantity')} onResize={(e) => startColumnResize(e, 'lines', 'quantity')} />
                <SortableHeader label="CA ligne" sortKey="actualLineRevenueXaf" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'actualLineRevenueXaf')} onResize={(e) => startColumnResize(e, 'lines', 'actualLineRevenueXaf')} />
                <SortableHeader label="Coût réel" sortKey="actualLineCostXaf" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'actualLineCostXaf')} onResize={(e) => startColumnResize(e, 'lines', 'actualLineCostXaf')} />
                <SortableHeader label="Marge ligne" sortKey="lineMarginXaf" sortState={lineSort} onSort={(k) => toggleSort('lines', k)} width={columnWidth('lines', 'lineMarginXaf')} onResize={(e) => startColumnResize(e, 'lines', 'lineMarginXaf')} />
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
