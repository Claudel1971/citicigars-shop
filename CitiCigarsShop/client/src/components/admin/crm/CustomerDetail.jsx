import React, { useEffect, useState } from 'react';
import { useRoute, Link } from 'wouter';
import { crmFetch } from './crmApi';

const fmtXaf = (n) =>
  n == null ? '?' : `${Math.round(Number(n)).toLocaleString('fr-FR')} XAF`;

const TYPE_LABELS = { B2C: 'B2C', CORPORATE: 'B2B', PARTNER: 'Partenaire', OTHER: 'Autre' };

const CustomerDetail = () => {
  const [, params] = useRoute('/admin/crm/:id');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const deleteInteraction = async (interactionId) => {
    if (!confirm('Supprimer définitivement cette note manuelle ?')) return;
    const res = await crmFetch(`/api/crm/interactions/${interactionId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || 'Suppression impossible');
    await load();
  };

  const deleteSale = async (orderId) => {
    if (!confirm(`Supprimer définitivement la vente ${orderId} ?`)) return;
    const res = await crmFetch(`/api/crm/sales/${orderId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || 'Suppression impossible');
    await load();
  };

  const setBlacklist = async (blacklisted) => {
    let reason = null;

    if (blacklisted) {
      reason = prompt('Motif de la blacklist (optionnel) :') ?? null;
      if (reason === null) return;
    }

    setBusy(true);
    try {
      const res = await crmFetch(`/api/crm/customers/${params.id}/blacklist`, {
        method: 'PUT',
        body: JSON.stringify({ blacklisted, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Mise à jour impossible');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      phoneWhatsapp: customer.phoneWhatsapp || '',
      email: customer.email || '',
      city: customer.city || '',
      country: customer.country || 'Cameroun',
      customerType: customer.customerType || 'B2C',
      companyName: customer.companyName || '',
      jobTitle: customer.jobTitle || '',
    });
    setEditError(null);
    setEditing(true);
  };

  const closeEdit = () => {
    setEditing(false);
    setEditForm(null);
  };

  const setEditField = (key, value) =>
    setEditForm((f) => ({ ...f, [key]: value }));

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditError(null);

    const hasIdentity =
      editForm.firstName.trim() ||
      editForm.lastName.trim() ||
      editForm.companyName.trim();

    if (!hasIdentity) {
      setEditError('Renseigne au moins un prénom, un nom ou une entreprise.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        firstName: editForm.firstName.trim() || null,
        lastName: editForm.lastName.trim() || null,
        phoneWhatsapp: editForm.phoneWhatsapp.trim() || null,
        email: editForm.email.trim() || null,
        city: editForm.city.trim() || null,
        country: editForm.country.trim() || null,
        customerType: editForm.customerType,
        companyName: editForm.companyName.trim() || null,
        jobTitle: editForm.jobTitle.trim() || null,
      };

      const res = await crmFetch(`/api/crm/customers/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Mise à jour impossible');

      closeEdit();
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteCustomer = async () => {
    if (!confirm(
      "Supprimer ce client ? S'il possède déjà un historique CRM, il sera conservé et placé en blacklist."
    )) return;

    const reason = prompt(
      "Motif si le client doit être placé en blacklist (optionnel) :"
    );
    if (reason === null) return;

    setBusy(true);
    try {
      const res = await crmFetch(`/api/crm/customers/${params.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Opération impossible');

      if (data.deleted) {
        window.location.href = '/admin/crm';
        return;
      }

      if (data.blacklisted) {
        alert("Le client possède un historique : il a été conservé et placé en blacklist.");
        await load();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!detail) return null;

  const { customer, interactions, dna, orders, summary } = detail;

  return (
    <div>
      <Link href="/admin/crm" className="text-sm text-primary hover:underline">
        ← Retour à la liste
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary mb-1">
            {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
              customer.companyName ||
              customer.customerId}
          </h1>
          <p className="text-gray-500 mb-4">
            {customer.phoneWhatsapp || 'Aucun téléphone'} · {TYPE_LABELS[customer.customerType] || customer.customerType}
            {customer.companyName ? ` ? ${customer.companyName}` : ''}
            {customer.isInternal ? ' ? (interne)' : ''}
          </p>
        </div>

        {!customer.isInternal && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openEdit}
              disabled={busy}
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Modifier
            </button>

            {customer.isBlacklisted ? (
              <button
                type="button"
                onClick={() => setBlacklist(false)}
                disabled={busy}
                className="rounded-md bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Retirer de la blacklist
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setBlacklist(true)}
                disabled={busy}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Blacklister
              </button>
            )}

            <button
              type="button"
              onClick={deleteCustomer}
              disabled={busy}
              className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      {customer.isBlacklisted && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
          <div className="font-semibold">Client blacklisté — nouvelles ventes bloquées</div>
          {customer.blacklistReason && (
            <div className="mt-1 text-sm">Motif : {customer.blacklistReason}</div>
          )}
          {customer.blacklistedAt && (
            <div className="mt-1 text-xs">
              Depuis le {new Date(customer.blacklistedAt).toLocaleString('fr-FR')}
            </div>
          )}
        </div>
      )}

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
            {summary.lastOrderDate
              ? new Date(summary.lastOrderDate).toLocaleDateString('fr-FR')
              : '?'}
          </div>
        </div>
      </div>

      {dna && (
        <div className="bg-white border rounded-md p-4 mb-8">
          <h2 className="font-semibold mb-2">Profil DNA</h2>
          <p className="text-sm">
            <span className="font-medium">{dna.profileName}</span> ({dna.profileCode}) — {dna.family}
          </p>
          {dna.profileTagline && (
            <p className="text-sm text-gray-500 italic">{dna.profileTagline}</p>
          )}
        </div>
      )}

      <div className="bg-white border rounded-md p-4 mb-8">
        <h2 className="font-semibold mb-3">Commandes</h2>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune commande.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Payé</th>
                  <th className="pb-2">Solde</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.orderId} className="border-t">
                    <td className="py-2">{new Date(o.orderDate).toLocaleDateString('fr-FR')}</td>
                    <td className="py-2">{fmtXaf(o.finalSaleTotalXaf)}</td>
                    <td className="py-2">{fmtXaf(o.amountPaid)}</td>
                    <td className="py-2">
                      {o.balanceDue > 0
                        ? <span className="text-red-600">{fmtXaf(o.balanceDue)}</span>
                        : '?'}
                    </td>
                    <td className="py-2 text-right">
                      {o.source === 'manual' && (
                        <button
                          type="button"
                          onClick={() => deleteSale(o.orderId)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-gray-500">
                      {new Date(i.interactionDate).toLocaleString('fr-FR')} · {i.channel} · {i.direction}
                    </div>
                    <div>{i.summary}</div>
                  </div>

                  {i.sourceType === 'manual' && i.createdBy === 'human' && (
                    <button
                      type="button"
                      onClick={() => deleteInteraction(i.interactionId)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-xl font-serif font-bold text-primary">
                Modifier le client
              </h2>

              <button
                type="button"
                onClick={closeEdit}
                className="text-2xl leading-none text-gray-400 hover:text-gray-700"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveEdit} className="p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Prénom</span>
                  <input value={editForm.firstName} onChange={(e) => setEditField('firstName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Nom</span>
                  <input value={editForm.lastName} onChange={(e) => setEditField('lastName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">WhatsApp / téléphone</span>
                  <input value={editForm.phoneWhatsapp} onChange={(e) => setEditField('phoneWhatsapp', e.target.value)} placeholder="+237..." className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Email</span>
                  <input type="email" value={editForm.email} onChange={(e) => setEditField('email', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Ville</span>
                  <input value={editForm.city} onChange={(e) => setEditField('city', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Pays</span>
                  <input value={editForm.country} onChange={(e) => setEditField('country', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Type</span>
                  <select value={editForm.customerType} onChange={(e) => setEditField('customerType', e.target.value)} className="w-full rounded-md border px-3 py-2">
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Entreprise</span>
                  <input value={editForm.companyName} onChange={(e) => setEditField('companyName', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium">Fonction</span>
                  <input value={editForm.jobTitle} onChange={(e) => setEditField('jobTitle', e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>
              </div>

              {editError && (
                <p className="mt-3 text-sm text-red-600">{editError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={savingEdit}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetail;
