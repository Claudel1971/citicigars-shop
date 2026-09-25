import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui/bespoke';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function Fournisseurs() {
  const [search,setSearch]=useState('');
  const suppliers=useQuery({queryKey:['suppliers'],queryFn:()=>api.suppliers()});
  const orders=useQuery({queryKey:['purchase-orders'],queryFn:()=>api.purchaseOrders()});
  const receipts=useQuery({queryKey:['receipts'],queryFn:()=>api.receipts()});
  const rows=useMemo(()=> {
    const q=search.toLowerCase();
    return (suppliers.data?.suppliers||[]).filter((s:any)=>`${s.code||''} ${s.name||''}`.toLowerCase().includes(q));
  },[suppliers.data,search]);
  const counts=new Map<string,{orders:number;receipts:number}>();
  for (const o of orders.data?.orders||[]) {
    const c=counts.get(o.supplierId)||{orders:0,receipts:0}; c.orders++; counts.set(o.supplierId,c);
  }
  for (const r of receipts.data?.receipts||[]) {
    const c=counts.get(r.supplierId)||{orders:0,receipts:0}; c.receipts++; counts.set(r.supplierId,c);
  }
  return <Layout><div className="space-y-6">
    <header><h1 className="text-3xl font-serif">Fournisseurs</h1><p className="text-sm text-muted-foreground mt-2">Sources réelles Purchasing : fournisseurs, PO et réceptions.</p></header>
    <Input placeholder="Code ou nom fournisseur…" value={search} onChange={e=>setSearch(e.target.value)} />
    {(suppliers.error||orders.error||receipts.error) && <p className="text-destructive">Une source Purchasing est indisponible.</p>}
    <Card><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Nom</TableHead><TableHead>Statut</TableHead><TableHead>PO</TableHead><TableHead>Réceptions</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>
      {rows.map((s:any)=>{const c=counts.get(s.supplierId)||{orders:0,receipts:0}; return <TableRow key={s.supplierId}><TableCell className="font-mono text-xs">{s.code}</TableCell><TableCell>{s.name}</TableCell><TableCell><Badge variant={s.active===false?'outline':'success'}>{s.active===false?'Inactif':'Actif'}</Badge></TableCell><TableCell>{c.orders}</TableCell><TableCell>{c.receipts}</TableCell><TableCell className="max-w-[280px] truncate">{s.notes||'—'}</TableCell></TableRow>})}
    </TableBody></Table></Card>
    <p className="text-xs text-muted-foreground">Les métriques « confiance », spend cumulé, pièces jointes et shadow state provenaient des fixtures et n'ont pas d'endpoint réel équivalent : elles ont été retirées.</p>
  </div></Layout>;
}
