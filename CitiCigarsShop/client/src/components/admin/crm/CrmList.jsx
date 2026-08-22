import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { crmFetch } from './crmApi';

const STATUS_LABELS = {
  PROSPECT: 'Prospect',
  QUALIFIED: 'Qualifi\u00e9',
  CUSTOMER: 'Client',
  DORMANT: 'Dormant',
  LOST: 'Perdu',
};

const TYPE_LABELS = {
  B2C: 'B2C',
  CORPORATE: 'B2B',
  PARTNER: 'Partenaire',
  OTHER: 'Autre',
};

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phoneWhatsapp: '',
  email: '',
  city: '',
  country: 'Cameroun',
  customerType: 'B2C',
  companyName: '',
  jobTitle: '',
  source: '',
  status: 'PROSPECT',
  notes: '',
};

const COLUMNS = [
  { key: 'customerId', label: 'ID Client', defaultWidth: 155 },
  { key: 'lastName', label: 'Nom', defaultWidth: 160 },
  { key: 'firstName', label: 'Pr\u00e9nom', defaultWidth: 140 },
  { key: 'phoneWhatsapp', label: 'T\u00e9l\u00e9phone', defaultWidth: 170 },
  { key: 'customerType', label: 'Type', defaultWidth: 105 },
  { key: 'status', label: 'Statut', defaultWidth: 110 },
  { key: 'city', label: 'Ville', defaultWidth: 120 },
  { key: 'balanceDueXaf', label: 'Balance', defaultWidth: 145 },
  { key: 'actions', label: 'Actions', defaultWidth: 100, sortable: false },
];

const DEFAULT_PREFS = {
  fontSize: 'normal',
  density: 'normal',
  hidden: [],
  widths: Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])),
};

const PREF_KEY = 'citicigars.crm.clients.tablePrefs';

const fmtXaf = (n) =>
  `${Math.round(Number(n || 0)).toLocaleString('fr-FR')} XAF`;

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    return saved
      ? {
          ...DEFAULT_PREFS,
          ...saved,
          widths: { ...DEFAULT_PREFS.widths, ...(saved.widths || {}) },
        }
      : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

const CrmList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('customerId');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showDisplay, setShowDisplay] = useState(false);

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search) params.set('search', search);

      const res = await crmFetch(`/api/crm/customers?${params.toString()}`);
      if (!res.ok) throw new Error('Erreur de chargement');

      setCustomers(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  const visible = (key) => !prefs.hidden.includes(key);

  const toggleColumn = (key) => {
    setPrefs((current) => ({
      ...current,
      hidden: current.hidden.includes(key)
        ? current.hidden.filter((x) => x !== key)
        : [...current.hidden, key],
    }));
  };

  const resetDisplay = () => {
    setPrefs(DEFAULT_PREFS);
  };

  const startResize = (e, key) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = prefs.widths[key] || 120;

    const move = (event) => {
      const next = Math.max(70, startWidth + event.clientX - startX);
      setPrefs((current) => ({
        ...current,
        widths: { ...current.widths, [key]: next },
      }));
    };

    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  const onSort = (key) => {
    if (key === 'actions') return;

    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(key === 'balanceDueXaf' ? 'desc' : 'asc');
    }
  };

  const sortedCustomers = useMemo(() => {
    const rows = [...customers];

    const valueFor = (c) => {
      switch (sortKey) {
        case 'lastName':
          return (c.lastName ?? '').toLocaleLowerCase('fr');
        case 'firstName':
          return (c.firstName ?? '').toLocaleLowerCase('fr');
        case 'phoneWhatsapp':
          return (c.phoneWhatsapp ?? '').toLocaleLowerCase('fr');
        case 'customerType':
          return c.customerType ?? '';
        case 'status':
          return c.status ?? '';
        case 'city':
          return (c.city ?? '').toLocaleLowerCase('fr');
        case 'balanceDueXaf':
          return Number(c.balanceDueXaf ?? 0);
        case 'customerId':
        default:
          return c.customerId ?? '';
      }
    };

    rows.sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);

      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), 'fr', {
          sensitivity: 'base',
          numeric: true,
        });
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [customers, sortKey, sortDirection]);

  const fontClass =
    prefs.fontSize === 'small'
      ? 'text-xs'
      : prefs.fontSize === 'large'
        ? 'text-base'
        : 'text-sm';

  const cellPadding =
    prefs.density === 'compact'
      ? 'px-3 py-1.5'
      : prefs.density === 'comfortable'
        ? 'px-3 py-4'
        : 'p-3';

  const Header = ({ column, right = false }) => {
    if (!visible(column.key)) return null;

    const active = sortKey === column.key;
    const sortable = column.sortable !== false;

    return (
      <th
        className={`${cellPadding} relative whitespace-nowrap ${right ? 'text-right' : ''}`}
        style={{
          width: prefs.widths[column.key],
          minWidth: prefs.widths[column.key],
          maxWidth: prefs.widths[column.key],
        }}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort(column.key)}
            className="inline-flex items-center gap-1 font-semibold hover:text-primary"
          >
            {column.label}
            <span className="text-[10px] text-gray-400">
              {active ? (sortDirection === 'asc' ? '?' : '?') : '?'}
            </span>
          </button>
        ) : (
          <span className="font-semibold">{column.label}</span>
        )}

        <span
          role="separator"
          onMouseDown={(e) => startResize(e, column.key)}
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-gray-200"
          title="Glisser pour ajuster la largeur"
        />
      </th>
    );
  };

  const Cell = ({ columnKey, children, className = '' }) => {
    if (!visible(columnKey)) return null;

    return (
      <td
        className={`${cellPadding} ${className}`}
        style={{
          width: prefs.widths[columnKey],
          minWidth: prefs.widths[columnKey],
          maxWidth: prefs.widths[columnKey],
        }}
      >
        {children}
      </td>
    );
  };

  const setFormField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const closeCreate = () => {
    if (saving) return;
    setShowCreate(false);
    setCreateError(null);
    setForm(EMPTY_FORM);
  };

  const createCustomer = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setNotice(null);

    const hasIdentity =
      form.firstName.trim() ||
      form.lastName.trim() ||
      form.companyName.trim();

    if (!hasIdentity) {
      setCreateError(
        'Renseigne au moins un pr\u00e9nom, un nom ou une entreprise.'
      );
      return;
    }

    setSaving(true);

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [
          k,
          typeof v === 'string' && v.trim() === ''
            ? null
            : typeof v === 'string'
              ? v.trim()
              : v,
        ])
      );

      payload.country = form.country.trim() || 'Cameroun';
      payload.customerType = form.customerType;
      payload.status = form.status;

      const res = await crmFetch('/api/crm/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '\u00c9chec de la cr\u00e9ation du client');
      }

      const customer = data.customer;

      setNotice(
        data.wasExistingDuplicate
          ? `T\u00e9l\u00e9phone d\u00e9j\u00e0 connu : client existant ${customer.customerId} r\u00e9utilis\u00e9, aucun doublon cr\u00e9\u00e9.`
          : `Client ${customer.customerId} cr\u00e9\u00e9 avec succ\u00e8s.`
      );

      setShowCreate(false);
      setForm(EMPTY_FORM);
      setSortKey('customerId');
      setSortDirection('asc');
      await load();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Clients CRM</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowDisplay((v) => !v)}
            className="border bg-white px-4 py-2 rounded-md text-sm"
          >
            Affichage
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
            className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
          >
            + Nouveau client
          </button>
        </div>
      </div>

      {showDisplay && (
        <div className="mb-4 rounded-md border bg-white p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="block mb-1 font-medium">Taille du texte</span>
              <select
                value={prefs.fontSize}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, fontSize: e.target.value }))
                }
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="small">Petit</option>
                <option value="normal">Normal</option>
                <option value="large">Grand</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="block mb-1 font-medium">Densit\u00e9 des lignes</span>
              <select
                value={prefs.density}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, density: e.target.value }))
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
                onClick={resetDisplay}
                className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm"
              >
                R\u00e9initialiser l'affichage
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-medium">Colonnes visibles</div>
            <div className="flex flex-wrap gap-3">
              {COLUMNS.map((column) => (
                <label key={column.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={visible(column.key)}
                    onChange={() => toggleColumn(column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              La largeur se r\u00e8gle directement en glissant le bord droit de chaque en-t\u00eate.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher (ID, nom, t\u00e9l\u00e9phone, entreprise)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 flex-1 min-w-[220px]"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-md px-3 py-2"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-gray-500">Chargement...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto bg-white rounded-md shadow-sm border">
          <table className={`w-full table-fixed ${fontClass}`}>
            <thead className="bg-gray-50 text-left">
              <tr>
                <Header column={COLUMNS[0]} />
                <Header column={COLUMNS[1]} />
                <Header column={COLUMNS[2]} />
                <Header column={COLUMNS[3]} />
                <Header column={COLUMNS[4]} />
                <Header column={COLUMNS[5]} />
                <Header column={COLUMNS[6]} />
                <Header column={COLUMNS[7]} right />
                <Header column={COLUMNS[8]} />
              </tr>
            </thead>

            <tbody>
              {sortedCustomers.map((c) => (
                <tr
                  key={c.customerId}
                  className={`border-t hover:bg-gray-50 ${
                    c.isBlacklisted ? 'bg-red-50/60' : ''
                  }`}
                >
                  <Cell columnKey="customerId" className="font-mono text-xs whitespace-nowrap">
                    {c.customerId}
                  </Cell>

                  <Cell columnKey="lastName" className="font-medium">
                    {c.lastName || (!c.firstName ? c.companyName : null) || '?'}
                    {c.companyName && (c.firstName || c.lastName) ? (
                      <div className="text-xs text-gray-500">{c.companyName}</div>
                    ) : null}
                  </Cell>

                  <Cell columnKey="firstName">
                    {c.firstName || '?'}
                  </Cell>

                  <Cell columnKey="phoneWhatsapp" className="whitespace-nowrap">
                    {c.phoneWhatsapp || '?'}
                  </Cell>

                  <Cell columnKey="customerType">
                    {TYPE_LABELS[c.customerType] || c.customerType}
                  </Cell>

                  <Cell columnKey="status">
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-xs">
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                      {c.isBlacklisted && (
                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">
                          Blacklist
                        </span>
                      )}
                    </div>
                  </Cell>

                  <Cell columnKey="city">
                    {c.city || '?'}
                  </Cell>

                  <Cell
                    columnKey="balanceDueXaf"
                    className={`text-right whitespace-nowrap ${
                      Number(c.balanceDueXaf || 0) > 0
                        ? 'font-semibold text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {fmtXaf(c.balanceDueXaf)}
                  </Cell>

                  <Cell columnKey="actions" className="whitespace-nowrap">
                    <Link
                      href={`/admin/crm/${c.customerId}`}
                      className="text-primary hover:underline"
                    >
                      Voir la fiche
                    </Link>
                  </Cell>
                </tr>
              ))}

              {sortedCustomers.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.filter((c) => visible(c.key)).length}
                    className="p-6 text-center text-gray-500"
                  >
                    Aucun client trouv\u00e9.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-primary">
                  Nouveau client
                </h2>
                <p className="text-xs text-gray-500">
                  L'ID CTCG-CUST-XXXXXX est attribu\u00e9 automatiquement \u00e0 l'enregistrement.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreate}
                className="text-2xl leading-none text-gray-400 hover:text-gray-700"
                aria-label="Fermer"
              >
                ?
              </button>
            </div>

            <form onSubmit={createCustomer} className="p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Pr\u00e9nom</span>
                  <input value={form.firstName} onChange={(e) => setFormField('firstName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Nom</span>
                  <input value={form.lastName} onChange={(e) => setFormField('lastName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">WhatsApp / t\u00e9l\u00e9phone</span>
                  <input value={form.phoneWhatsapp} onChange={(e) => setFormField('phoneWhatsapp', e.target.value)} placeholder="+237..." className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Email</span>
                  <input type="email" value={form.email} onChange={(e) => setFormField('email', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Ville</span>
                  <input value={form.city} onChange={(e) => setFormField('city', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Pays</span>
                  <input value={form.country} onChange={(e) => setFormField('country', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Type</span>
                  <select value={form.customerType} onChange={(e) => setFormField('customerType', e.target.value)} className="w-full rounded-md border px-3 py-2">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Statut</span>
                  <select value={form.status} onChange={(e) => setFormField('status', e.target.value)} className="w-full rounded-md border px-3 py-2">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Entreprise</span>
                  <input value={form.companyName} onChange={(e) => setFormField('companyName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Fonction</span>
                  <input value={form.jobTitle} onChange={(e) => setFormField('jobTitle', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Source</span>
                  <input value={form.source} onChange={(e) => setFormField('source', e.target.value)} placeholder="WhatsApp, recommandation, DNA, \u00e9v\u00e9nement..." className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Notes</span>
                  <textarea value={form.notes} onChange={(e) => setFormField('notes', e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2" />
                </label>
              </div>

              {createError && (
                <p className="mt-3 text-sm text-red-600">{createError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={saving}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Cr\u00e9ation...' : 'Cr\u00e9er le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmList;
