import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui/bespoke';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function Stock() {
  const [search,setSearch]=useState('');
  const stock=useQuery({queryKey:['stock',search],queryFn:()=>api.stock(search)});
  return <Layout><div className="space-y-6">
    <header><h1 className="text-3xl font-serif">Stock Central</h1><p className="text-sm text-muted-foreground mt-2">Lecture réelle du ledger/projection Stock Central.</p></header>
    <Input placeholder="SKU, marque, ligne, vitole…" value={search} onChange={e=>setSearch(e.target.value)} />
    {stock.isLoading && <p>Chargement…</p>}
    {stock.error && <p className="text-destructive">Impossible de charger le stock.</p>}
    <Card><Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Produit</TableHead><TableHead>Identité</TableHead><TableHead>En main</TableHead><TableHead>Disponible</TableHead><TableHead>Réservé client</TableHead><TableHead>Transit</TableHead></TableRow></TableHeader><TableBody>
      {(stock.data?.positions||[]).map((p:any,index:number)=><TableRow key={`${p.sku.sku}-${p.identity?.type||'none'}-${p.identity?.packSize||0}-${index}`}>
        <TableCell className="font-mono text-xs">{p.sku.sku}</TableCell>
        <TableCell>{[p.sku.marque,p.sku.ligne,p.sku.vitole].filter(Boolean).join(' · ') || '—'}</TableCell>
        <TableCell>{p.identity ? <Badge variant="secondary">{p.identity.type} / {p.identity.packSize}</Badge> : '—'}</TableCell>
        <TableCell>{p.onHandQty ?? 0}</TableCell><TableCell>{p.availableQty ?? 0}</TableCell><TableCell>{p.reservedClientQty ?? 0}</TableCell><TableCell>{p.transitQty ?? 0}</TableCell>
      </TableRow>)}
    </TableBody></Table></Card>
    <p className="text-xs text-muted-foreground">Aucun mouvement stock n'est exécuté par CLOSE-02. Le moteur Stock Central reste intact et l'Admin utilise uniquement GET /api/admin/stock.</p>
  </div></Layout>;
}
