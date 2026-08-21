import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { crmFetch } from './crmApi';

const fmtXaf = (n) => `${Math.round(Number(n || 0)).toLocaleString('fr-FR')} XAF`;
const today = () => new Date().toISOString().slice(0, 10);

const emptyLine = () => ({
  itemType: 'PRODUCT',
  sku: '',
  label: '',
  quantity: 1,
  regularUnitPriceXaf: '',
  promoUnitPriceXaf: '',
});

const ITEM_TYPES = [
  ['PRODUCT', 'Produit'],
  ['BUNDLE', 'Bundle / Coffret'],
  ['ACCESSORY', 'Accessoire'],
  ['SERVICE', 'Service'],
  ['CUSTOM', 'Autre / personnalisé'],
];

function computePreview(lines, extraDiscount) {
  const parsed = lines.map((l) => {
    const qty = Math.max(0, Number(l.quantity) || 0);
    const regular = Math.max(0, Number(l.regularUnitPriceXaf) || 0);
    const promo = l.promoUnitPriceXaf === '' ? null : Math.max(0, Number(l.promoUnitPriceXaf) || 0);
    const effective = promo == null ? regular : promo;
    return { regularTotal: qty * regular, subtotal: qty * effective };
  });
  const regular = parsed.reduce((s, x) => s + x.regularTotal, 0);
  const afterPromo = parsed.reduce((s, x) => s + x.subtotal, 0);
  const productDiscounts = regular - afterPromo;
  const extra = Math.max(0, Number(extraDiscount) || 0);
  return {
    regular,
    productDiscounts,
    afterPromo,
    extra,
    net: Math.max(0, afterPromo - extra),
  };
}

const NewSale = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [lines, setLines] = useState([emptyLine()]);
  const [extraDiscount, setExtraDiscount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    Promise.all([
      crmFetch('/api/crm/customers').then((r) => (r.ok ? r.json() : Promise.reject(new Error('Clients indisponibles')))),
      crmFetch('/api/products').then((r) => (r.ok ? r.json() : [])),
      crmFetch('/api/bundles').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, p, b]) => {
        setCustomers(c.filter((x) => !x.isInternal));
        setProducts(p);
        setBundles(b);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const preview = useMemo(() => computePreview(lines, extraDiscount), [lines, extraDiscount]);

  const updateLine = (idx, key, value) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  };

  const changeType = (idx, itemType) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...emptyLine(), itemType } : l)));
  };

  const chooseSku = (idx, sku) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      if (l.itemType === 'PRODUCT') {
        const p = products.find((x) => x.sku === sku);
        return {
          ...l,
          sku,
          label: p ? [p.marque, p.ligne, p.vitole].filter(Boolean).join(' — ') : '',
          regularUnitPriceXaf: p?.prixBoite ?? p?.prixPack ?? p?.prixUnitaire ?? '',
          promoUnitPriceXaf: '',
        };
      }
      if (l.itemType === 'BUNDLE') {
        const b = bundles.find((x) => x.sku === sku);
        return {
          ...l,
          sku,
          label: b?.nom || '',
          regularUnitPriceXaf: b?.prixBundle ?? '',
          promoUnitPriceXaf: '',
        };
      }
      return { ...l, sku };
    }));
  };

  const selectedCatalogHint = (line) => {
    if (line.itemType !== 'PRODUCT' || !line.sku) return null;
    const p = products.find((x) => x.sku === line.sku);
    if (!p) return null;
    const bits = [];
    if (p.prixBoite != null) bits.push(`Boîte ${fmtXaf(p.prixBoite)}`);
    if (p.prixPack != null) bits.push(`Pack ${fmtXaf(p.prixPack)}`);
    if (p.prixUnitaire != null) bits.push(`Unitaire ${fmtXaf(p.prixUnitaire)}`);
    return bits.join(' · ');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    if (!customerId) return setError('Choisis un client.');
    if (lines.some((l) => !l.sku.trim())) return setError('Chaque ligne doit avoir un SKU.');
    if (lines.some((l) => Number(l.quantity) <= 0)) return setError('Chaque quantité doit être supérieure à 0.');
    if (lines.some((l) => l.regularUnitPriceXaf === '' || Number(l.regularUnitPriceXaf) < 0)) return setError('Renseigne le prix catalogue de chaque ligne.');
    if (Number(extraDiscount || 0) > preview.afterPromo) return setError('La remise commande dépasse le sous-total.');
    if (Number(amountPaid || 0) > preview.net) return setError('Le montant encaissé dépasse le net commande.');

    setSaving(true);
    try {
      const payload = {
        customerId,
        orderDate: `${orderDate}T12:00:00.000Z`,
        lines: lines.map((l) => ({
          itemType: l.itemType,
          sku: l.sku.trim(),
          label: l.label.trim() || null,
          quantity: Number(l.quantity),
          regularUnitPriceXaf: Number(l.regularUnitPriceXaf),
          promoUnitPriceXaf: l.promoUnitPriceXaf === '' ? null : Number(l.promoUnitPriceXaf),
        })),
        extraCustomerDiscountXaf: Number(extraDiscount || 0),
        amountPaid: Number(amountPaid || 0),
        paymentDate: Number(amountPaid || 0) > 0 ? `${paymentDate || orderDate}T12:00:00.000Z` : null,
        notes: notes.trim() || null,
      };
      const res = await crmFetch('/api/crm/sales', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Échec de la création de la vente');
      setCreated(data);
      setLines([emptyLine()]);
      setExtraDiscount('');
      setAmountPaid('');
      setNotes('');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">Nouvelle vente</h1>
          <p className="text-sm text-gray-500">Création manuelle d’une commande CRM.</p>
        </div>
        <Link href="/admin/crm-transactions" className="text-sm text-primary hover:underline">Voir les transactions</Link>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {created && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
          <strong>{created.orderId}</strong> créée — net {fmtXaf(created.finalSaleTotalXaf)}, encaissé {fmtXaf(created.amountPaid)}, balance {fmtXaf(created.balanceDue)}.
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-md border bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium">Client *</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full rounded-md border px-3 py-2">
                <option value="">Sélectionner un client...</option>
                {customers.map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.customerId} — {[c.lastName, c.firstName].filter(Boolean).join(' ') || c.companyName || 'Sans nom'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Date de vente *</span>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full rounded-md border px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="rounded-md border bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold">Lignes de vente</h2>
            <button type="button" onClick={() => setLines((x) => [...x, emptyLine()])} className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200">+ Ajouter une ligne</button>
          </div>

          <div className="space-y-4">
            {lines.map((line, idx) => (
              <div key={idx} className="rounded-md border p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block font-medium">Type</span>
                    <select value={line.itemType} onChange={(e) => changeType(idx, e.target.value)} className="w-full rounded-md border px-2 py-2">
                      {ITEM_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </label>

                  <label className="text-sm md:col-span-4">
                    <span className="mb-1 block font-medium">SKU / article *</span>
                    {line.itemType === 'PRODUCT' ? (
                      <select value={line.sku} onChange={(e) => chooseSku(idx, e.target.value)} className="w-full rounded-md border px-2 py-2">
                        <option value="">Choisir un produit...</option>
                        {products.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {[p.marque, p.ligne, p.vitole].filter(Boolean).join(' — ')}</option>)}
                      </select>
                    ) : line.itemType === 'BUNDLE' ? (
                      <select value={line.sku} onChange={(e) => chooseSku(idx, e.target.value)} className="w-full rounded-md border px-2 py-2">
                        <option value="">Choisir un bundle...</option>
                        {bundles.map((b) => <option key={b.sku} value={b.sku}>{b.sku} — {b.nom}</option>)}
                      </select>
                    ) : (
                      <input value={line.sku} onChange={(e) => updateLine(idx, 'sku', e.target.value)} placeholder="CTCG-ACC-..., CTCG-SRV-..." className="w-full rounded-md border px-2 py-2" />
                    )}
                    {selectedCatalogHint(line) && <span className="mt-1 block text-xs text-gray-500">Tarifs catalogue : {selectedCatalogHint(line)}</span>}
                  </label>

                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block font-medium">Qté *</span>
                    <input type="number" min="1" step="1" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} className="w-full rounded-md border px-2 py-2" />
                  </label>

                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block font-medium">Prix catalogue *</span>
                    <input type="number" min="0" step="1" value={line.regularUnitPriceXaf} onChange={(e) => updateLine(idx, 'regularUnitPriceXaf', e.target.value)} className="w-full rounded-md border px-2 py-2" />
                  </label>

                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block font-medium">Prix promo</span>
                    <input type="number" min="0" step="1" value={line.promoUnitPriceXaf} onChange={(e) => updateLine(idx, 'promoUnitPriceXaf', e.target.value)} placeholder="—" className="w-full rounded-md border px-2 py-2" />
                  </label>
                </div>

                {(line.itemType === 'ACCESSORY' || line.itemType === 'SERVICE' || line.itemType === 'CUSTOM') && (
                  <label className="mt-3 block text-sm">
                    <span className="mb-1 block font-medium">Description</span>
                    <input value={line.label} onChange={(e) => updateLine(idx, 'label', e.target.value)} className="w-full rounded-md border px-2 py-2" />
                  </label>
                )}

                {lines.length > 1 && (
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => setLines((x) => x.filter((_, i) => i !== idx))} className="text-xs text-red-600 hover:underline">Supprimer la ligne</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border bg-white p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Remise supplémentaire commande</span>
                <input type="number" min="0" step="1" value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Montant encaissé</span>
                <input type="number" min="0" step="1" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>
              {Number(amountPaid || 0) > 0 && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Date encaissement</span>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </label>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border px-3 py-2" />
              </label>
            </div>

            <div className="rounded-md bg-gray-50 p-4 text-sm">
              <div className="flex justify-between py-1"><span>Catalogue</span><strong>{fmtXaf(preview.regular)}</strong></div>
              <div className="flex justify-between py-1"><span>Promotions produits</span><span>- {fmtXaf(preview.productDiscounts)}</span></div>
              <div className="flex justify-between py-1"><span>Sous-total</span><strong>{fmtXaf(preview.afterPromo)}</strong></div>
              <div className="flex justify-between py-1"><span>Remise commande</span><span>- {fmtXaf(preview.extra)}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base"><span>Net commande</span><strong>{fmtXaf(preview.net)}</strong></div>
              <div className="flex justify-between py-1"><span>Encaissé</span><strong>{fmtXaf(amountPaid)}</strong></div>
              <div className="flex justify-between py-1"><span>Balance</span><strong className={Math.max(0, preview.net - Number(amountPaid || 0)) > 0 ? 'text-red-600' : ''}>{fmtXaf(Math.max(0, preview.net - Number(amountPaid || 0)))}</strong></div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs text-amber-700">
            Phase 1 : cette saisie enregistre la vente dans le CRM. Elle ne génère pas encore automatiquement le mouvement Stock Central, car le bucket physique vendu (boîte/pack/etc.) n’est pas capturé ici.
          </p>
          <button type="submit" disabled={saving} className="rounded-md bg-primary px-5 py-2.5 font-medium text-white disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Créer la vente'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewSale;
