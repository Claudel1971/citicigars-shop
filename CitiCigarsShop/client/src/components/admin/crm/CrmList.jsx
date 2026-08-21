import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { crmFetch } from './crmApi';

const STATUS_LABELS = {
  PROSPECT: 'Prospect',
  QUALIFIED: 'Qualifié',
  CUSTOMER: 'Client',
  DORMANT: 'Dormant',
  LOST: 'Perdu',
};

const TYPE_LABELS = {
  B2C: 'B2C',
  CORPORATE: 'Corporate',
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

const fmtXaf = (n) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

const SortHeader = ({ label, sortKey, activeKey, direction, onSort, className = '' }) => (
  <th className={`p-3 whitespace-nowrap ${className}`}>
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 font-semibold hover:text-primary focus:outline-none focus:underline"
      title={`Trier par ${label}`}
    >
      {label}
      <span className="text-[10px] text-gray-400" aria-hidden="true">
        {activeKey === sortKey ? (direction === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  </th>
);

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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const res = await crmFetch(`/api/crm/customers?${params.toString()}`);
      if (!res.ok) throw new Error('Erreur de chargement');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  const onSort = (key) => {
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
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base', numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [customers, sortKey, sortDirection]);

  const setFormField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

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

    const hasIdentity = form.firstName.trim() || form.lastName.trim() || form.companyName.trim();
    if (!hasIdentity) {
      setCreateError('Renseigne au moins un prénom, un nom ou une entreprise.');
      return;
    }

    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v])
      );
      // Preserve defaults that must never be null.
      payload.country = form.country.trim() || 'Cameroun';
      payload.customerType = form.customerType;
      payload.status = form.status;

      const res = await crmFetch('/api/crm/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec de la création du client');

      const customer = data.customer;
      if (data.wasExistingDuplicate) {
        setNotice(`Téléphone déjà connu : client existant ${customer.customerId} réutilisé, aucun doublon créé.`);
      } else {
        setNotice(`Client ${customer.customerId} créé avec succès.`);
      }
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

      {notice && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher (ID, nom, téléphone, entreprise)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 flex-1 min-w-[220px]"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-md px-3 py-2">
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <SortHeader label="ID Client" sortKey="customerId" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Nom" sortKey="lastName" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Prénom" sortKey="firstName" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Téléphone" sortKey="phoneWhatsapp" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Type" sortKey="customerType" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Statut" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Ville" sortKey="city" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Balance" sortKey="balanceDueXaf" activeKey={sortKey} direction={sortDirection} onSort={onSort} className="text-right" />
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((c) => (
                <tr key={c.customerId} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs whitespace-nowrap">{c.customerId}</td>
                  <td className="p-3 font-medium">
                    {c.lastName || (!c.firstName ? c.companyName : null) || '—'}
                    {c.companyName && (c.firstName || c.lastName) ? <div className="text-xs text-gray-500">{c.companyName}</div> : null}
                  </td>
                  <td className="p-3">{c.firstName || '—'}</td>
                  <td className="p-3 whitespace-nowrap">{c.phoneWhatsapp || '—'}</td>
                  <td className="p-3">{TYPE_LABELS[c.customerType] || c.customerType}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-xs">
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="p-3">{c.city || '—'}</td>
                  <td className={`p-3 text-right whitespace-nowrap ${Number(c.balanceDueXaf || 0) > 0 ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                    {fmtXaf(c.balanceDueXaf)}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/admin/crm/${c.customerId}`} className="text-primary hover:underline">
                      Voir la fiche
                    </Link>
                  </td>
                </tr>
              ))}
              {sortedCustomers.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">
                    Aucun client trouvé.
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
                <h2 className="text-xl font-serif font-bold text-primary">Nouveau client</h2>
                <p className="text-xs text-gray-500">L’ID CTCG-CUST-XXXXXX est attribué automatiquement à l’enregistrement.</p>
              </div>
              <button type="button" onClick={closeCreate} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Fermer">×</button>
            </div>

            <form onSubmit={createCustomer} className="p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Prénom</span>
                  <input value={form.firstName} onChange={(e) => setFormField('firstName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Nom</span>
                  <input value={form.lastName} onChange={(e) => setFormField('lastName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">WhatsApp / téléphone</span>
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
                    {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Statut</span>
                  <select value={form.status} onChange={(e) => setFormField('status', e.target.value)} className="w-full rounded-md border px-3 py-2">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                  <input value={form.source} onChange={(e) => setFormField('source', e.target.value)} placeholder="WhatsApp, recommandation, DNA, événement..." className="w-full rounded-md border px-3 py-2" />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block font-medium">Notes</span>
                  <textarea value={form.notes} onChange={(e) => setFormField('notes', e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2" />
                </label>
              </div>

              {createError && <p className="mt-3 text-sm text-red-600">{createError}</p>}

              <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={closeCreate} disabled={saving} className="rounded-md bg-gray-100 px-4 py-2 text-sm disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {saving ? 'Création...' : 'Créer le client'}
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
