import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { crmFetch } from './crmApi';

const Followups = () => {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmFetch('/api/crm/followups');
      if (!res.ok) throw new Error('Erreur de chargement');
      setFollowups(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const complete = async (id) => {
    setBusyId(id);
    try {
      await crmFetch(`/api/crm/followups/${id}/complete`, { method: 'PUT' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id) => {
    setBusyId(id);
    try {
      await crmFetch(`/api/crm/followups/${id}/cancel`, { method: 'PUT' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const isOverdue = (dueAt) => new Date(dueAt) < new Date(new Date().toDateString());

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-primary mb-4">Relances</h1>

      {loading && <p className="text-gray-500">Chargement...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border rounded-md divide-y">
          {followups.length === 0 && <p className="p-6 text-center text-gray-500">Aucune relance ouverte.</p>}
          {followups.map((f) => (
            <div key={f.followupId} className="p-4 flex items-start justify-between gap-4">
              <div>
                <div className={`text-sm ${isOverdue(f.dueAt) ? 'text-red-600 font-medium' : ''}`}>
                  Échéance : {new Date(f.dueAt).toLocaleDateString('fr-FR')}
                  {isOverdue(f.dueAt) ? ' (en retard)' : ''}
                </div>
                <div className="mt-1">{f.action}</div>
                <Link href={`/admin/crm/${f.customerId}`} className="text-xs text-primary hover:underline">
                  Voir la fiche client
                </Link>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => complete(f.followupId)}
                  disabled={busyId === f.followupId}
                  className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  Fait
                </button>
                <button
                  onClick={() => cancel(f.followupId)}
                  disabled={busyId === f.followupId}
                  className="text-xs bg-gray-200 px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Followups;
