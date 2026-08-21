import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { crmFetch } from './crmApi';

const STATUS_LABELS = {
  PROSPECT: 'Prospect',
  QUALIFIED: 'Qualifié',
  CUSTOMER: 'Client',
  DORMANT: 'Dormant',
  LOST: 'Perdu',
};

const CrmList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

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

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-primary mb-4">Clients CRM</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher (nom, téléphone, entreprise)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 flex-1 min-w-[200px]"
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
                <th className="p-3">Nom</th>
                <th className="p-3">Téléphone</th>
                <th className="p-3">Type</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Ville</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customerId} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">
                    {c.firstName} {c.lastName}
                    {c.companyName ? <div className="text-xs text-gray-500">{c.companyName}</div> : null}
                  </td>
                  <td className="p-3">{c.phoneWhatsapp || '—'}</td>
                  <td className="p-3">{c.customerType}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-xs">
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="p-3">{c.city || '—'}</td>
                  <td className="p-3">
                    <Link href={`/admin/crm/${c.customerId}`} className="text-primary hover:underline">
                      Voir la fiche
                    </Link>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    Aucun client trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CrmList;
