import React, { useEffect, useState } from 'react';
import { crmFetch } from './crmApi';
const fmt=n=>n==null?'Inconnu':Number(n).toLocaleString('fr-FR',{maximumFractionDigits:2});
export default function HistoricalAudit(){
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true;crmFetch('/api/crm/historical-audit').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError('Le détail de l’import historique est indisponible.');});return()=>{active=false;};},[]);
  if(error)return <p role="status" className="text-sm text-gray-600 mb-3">{error}</p>;
  if(!data)return null;
  return <section className="border rounded-lg p-4 mb-4 bg-white">
    <h3 className="font-semibold mb-2">Consignations et avances</h3>
    <p className="text-sm text-gray-600 mb-2">Les avances sont distinctes des ventes et des créances clients. Les marchandises en dépôt restent la propriété de CitiCigars.</p>
    <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th className="text-left">Référence / partenaire</th><th>Valeur FCFA</th><th>Avance FCFA</th><th>Solde commercial FCFA</th></tr></thead><tbody>{data.consignments.map(c=><tr key={c.id} className="border-t"><td>{c.id} · {c.customer}</td><td className="text-right">{fmt(c.valueXaf)}</td><td className="text-right">{fmt(c.advanceXaf)}</td><td className="text-right">{fmt(c.balanceXaf)}</td></tr>)}</tbody></table></div>
    {data.incompleteCostTransactions>0&&<p className="text-sm mt-3">{data.incompleteCostTransactions} transaction(s) ont un coût partiellement inconnu. Leur marge recalculée reste indéterminée.</p>}
    <details className="mt-3"><summary className="cursor-pointer">Achats historiques : brut, remise, net et coût rendu</summary><div className="overflow-x-auto mt-2"><table className="text-sm w-full"><thead><tr><th>Fournisseur / SKU</th><th>Qté</th><th>Devise facture</th><th>Brut</th><th>Remise</th><th>Net</th><th>Net FCFA</th><th>Rendu / unité FCFA</th></tr></thead><tbody>{data.purchases.map(p=><tr key={p.supplier+p.sku} className="border-t"><td>{p.supplier} · {p.sku}</td><td>{p.quantity}</td><td>{p.currency??'Source détaillée'}</td><td>{fmt(p.gross)}</td><td>{fmt(p.discount)}</td><td>{fmt(p.net)}</td><td>{fmt(p.netXaf)}</td><td>{fmt(p.landedUnitCostXaf)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
