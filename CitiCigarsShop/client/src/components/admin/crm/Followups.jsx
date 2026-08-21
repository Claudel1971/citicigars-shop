import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { crmFetch } from './crmApi';

const TABS = [
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'DONE', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

const Followups = () => {
  const [status, setStatus] = useState('OPEN');
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async (nextStatus = status) => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmFetch(`/api/crm/followups?status=${nextStatus}`);
      if (!res.ok) throw new Error('Erreur de chargement');
      setFollowups(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const complete = async (id) => {
    setBusyId(id);
    try {
      const res = await crmFetch(`/api/crm/followups/${id}/complete`, { method: 'PUT' });
      if (!res.ok) throw new Error('Impossible de terminer la relance');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id) => {
    setBusyId(id);
    try {
      const res = await crmFetch(`/api/crm/followups/${id}/cancel`, { method: 'PUT' });
      if (!res.ok) throw new Error("Impossible d'annuler la relance");
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const reopen = async (id) => {
    setBusyId(id);
    try {
      const res = await crmFetch(`/api/crm/followups/${id}/reopen`, { method: 'PUT' });
      if (!res.ok) throw new Error('Impossible de réouvrir la relance');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const isOverdue = (dueAt) =>
    status === 'OPEN' && new Date(dueAt) < new Date(new Date().toDateString());

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-primary mb-4">Relances</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`px-4 py-2 rounded-md text-sm ${
              status === tab.value ? 'bg-primary text-white' : 'bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500">Chargement...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white border rounded-md divide-y">
          {followups.length === 0 && (
            <p className="p-6 text-center text-gray-500">
              Aucune relance dans cette catégorie.
            </p>
          )}

          {followups.map((f) => (
            <div key={f.followupId} className="p-4 flex items-start justify-between gap-4">
              <div>
                <div className={`text-sm ${isOverdue(f.dueAt) ? 'text-red-600 font-medium' : ''}`}>
                  Échéance : {new Date(f.dueAt).toLocaleDateString('fr-FR')}
                  {isOverdue(f.dueAt) ? ' (en retard)' : ''}
                </div>

                <div className="mt-1">{f.action}</div>

                {f.completedAt && status === 'DONE' && (
                  <div className="text-xs text-gray-500 mt-1">
                    Terminée le {new Date(f.completedAt).toLocaleString('fr-FR')}
                  </div>
                )}

                <Link
                  href={`/admin/crm/${f.customerId}`}
                  className="text-xs text-primary hover:underline"
                >
                  Voir la fiche client
                </Link>
              </div>

              <div className="flex gap-2 shrink-0">
                {status === 'OPEN' ? (
                  <>
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
                  </>
                ) : (
                  <button
                    onClick={() => reopen(f.followupId)}
                    disabled={busyId === f.followupId}
                    className="text-xs bg-primary text-white px-3 py-1.5 rounded-md disabled:opacity-50"
                  >
                    Réouvrir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Followups;
