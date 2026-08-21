import React, { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { crmFetch } from './crmApi';

const fmtXaf = (n) => (n == null ? '—' : `${Number(n).toLocaleString('fr-FR')} XAF`);

const CustomerDetail = () => {
  const [, params] = useRoute('/admin/crm/:id');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmFetch(`/api/crm/customers/${params.id}`);
      if (!res.ok) throw new Error('Client introuvable');
      setDetail(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await crmFetch(`/api/crm/customers/${params.id}/interactions`, {
        method: 'POST',
        body: JSON.stringify({
          channel: 'manual',
          interactionDate: new Date().toISOString(),
          direction: 'OUTBOUND',
          summary: noteText,
          sourceType: 'manual',
          createdBy: 'human',
        }),
      });
      if (!res.ok) throw new Error("Échec de l'ajout de la note");
      setNoteText('');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!detail) return null;

  const { customer, interactions, dna, orders, summary } = detail;

  return (
    <div>
      <Link href="/admin/crm" className="text-sm text-primary hover:underline">← Retour à la liste</Link>

      <h1 className="text-2xl font-serif font-bold text-primary mt-2 mb-1">
        {customer.firstName} {customer.lastName}
      </h1>
      <p className="text-gray-500 mb-6">
        {customer.phoneWhatsapp || 'Aucun téléphone'} · {customer.customerType}
        {customer.companyName ? ` · ${customer.companyName}` : ''}
        {customer.isInternal ? ' · (interne)' : ''}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-md p-4">
          <div className="text-xs text-gray-500">Commandes</div>
          <div className="text-xl font-bold">{summary.orderCount}</div>
        </div>
        <div className="bg-white border rounded-md p-4">
          <div className="text-xs text-gray-500">CA total</div>
          <div className="text-xl font-bold">{fmtXaf(summary.totalRevenueXaf)}</div>
        </div>
        <div className="bg-white border rounded-md p-4">
          <div className="text-xs text-gray-500">Panier moyen</div>
          <div className="text-xl font-bold">{fmtXaf(summary.averageBasketXaf)}</div>
        </div>
        <div className="bg-white border rounded-md p-4">
          <div className="text-xs text-gray-500">Dernière vente</div>
          <div className="text-xl font-bold">
            {summary.lastOrderDate ? new Date(summary.lastOrderDate).toLocaleDateString('fr-FR') : '—'}
          </div>
        </div>
      </div>

      {dna && (
        <div className="bg-white border rounded-md p-4 mb-8">
          <h2 className="font-semibold mb-2">Profil DNA</h2>
          <p className="text-sm">
            <span className="font-medium">{dna.profileName}</span> ({dna.profileCode}) — {dna.family}
          </p>
          {dna.profileTagline && <p className="text-sm text-gray-500 italic">{dna.profileTagline}</p>}
        </div>
      )}

      <div className="bg-white border rounded-md p-4 mb-8">
        <h2 className="font-semibold mb-3">Commandes</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune commande.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Payé</th>
                <th className="pb-2">Solde</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId} className="border-t">
                  <td className="py-2">{new Date(o.orderDate).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2">{fmtXaf(o.finalSaleTotalXaf)}</td>
                  <td className="py-2">{fmtXaf(o.amountPaid)}</td>
                  <td className="py-2">{o.balanceDue > 0 ? <span className="text-red-600">{fmtXaf(o.balanceDue)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border rounded-md p-4">
        <h2 className="font-semibold mb-3">Interactions</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Ajouter une note rapide..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="border rounded-md px-3 py-2 flex-1"
          />
          <button
            onClick={addNote}
            disabled={savingNote}
            className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
        {interactions.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune interaction.</p>
        ) : (
          <ul className="space-y-3">
            {interactions.map((i) => (
              <li key={i.interactionId} className="border-t pt-3 text-sm">
                <div className="text-xs text-gray-500">
                  {new Date(i.interactionDate).toLocaleString('fr-FR')} · {i.channel} · {i.direction}
                </div>
                <div>{i.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CustomerDetail;
