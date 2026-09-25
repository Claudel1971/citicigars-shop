import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent, Badge } from '@/components/ui/bespoke';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

type Result = { type: string; id: string; title: string; sub: string; link: string };

export default function Recherche() {
  const [query, setQuery] = useState('');
  const enabled = query.trim().length > 2;
  const customers = useQuery({ queryKey: ['search-customers', query], queryFn: () => api.customers(query), enabled });
  const stock = useQuery({ queryKey: ['search-stock', query], queryFn: () => api.stock(query), enabled });
  const suppliers = useQuery({ queryKey: ['search-suppliers'], queryFn: () => api.suppliers(), enabled });

  const results = useMemo<Result[]>(() => {
    if (!enabled) return [];
    const q = query.toLowerCase();
    const rows: Result[] = [];
    for (const c of customers.data ?? []) {
      rows.push({ type:'Client', id:c.customerId, title:[c.firstName,c.lastName].filter(Boolean).join(' ') || c.companyName || c.customerId, sub:c.phoneWhatsapp || c.email || c.companyName || '', link:`/clients?id=${c.customerId}` });
    }
    for (const p of stock.data?.positions ?? []) {
      rows.push({ type:'Stock', id:p.sku.sku, title:[p.sku.marque,p.sku.ligne,p.sku.vitole].filter(Boolean).join(' · ') || p.sku.sku, sub:p.identity ? `${p.identity.type} · pack ${p.identity.packSize} · disponible ${p.availableQty ?? 0}` : 'Aucune position', link:`/stock?sku=${p.sku.sku}` });
    }
    for (const s of suppliers.data?.suppliers ?? []) {
      const haystack=`${s.code ?? ''} ${s.name ?? ''}`.toLowerCase();
      if (haystack.includes(q)) rows.push({ type:'Fournisseur', id:s.supplierId, title:s.name, sub:s.code || '', link:`/fournisseurs?id=${s.supplierId}` });
    }
    return rows;
  }, [enabled, query, customers.data, stock.data, suppliers.data]);

  const loading=customers.isFetching || stock.isFetching || suppliers.isFetching;
  return <Layout><div className="max-w-4xl mx-auto space-y-6">
    <header className="text-center"><h1 className="text-3xl font-serif">Recherche Globale</h1><p className="text-sm text-muted-foreground mt-2">Clients, stock et fournisseurs réels.</p></header>
    <div className="relative"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"/><Input autoFocus className="pl-12 h-14" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, client ID, SKU, marque, fournisseur…"/></div>
    {enabled && <div className="space-y-3">
      <p className="text-xs font-mono text-muted-foreground uppercase">{loading ? 'Recherche…' : `${results.length} résultat(s)`}</p>
      {results.map((r,i)=><Link key={`${r.type}-${r.id}-${i}`} href={r.link} className="block group"><Card><CardContent className="p-4 flex justify-between items-center"><div><div className="flex gap-2 items-center"><Badge variant="secondary">{r.type}</Badge><span className="text-[10px] font-mono text-muted-foreground">{r.id}</span></div><p className="font-medium mt-2">{r.title}</p><p className="text-sm text-muted-foreground">{r.sub}</p></div><ArrowRight className="w-4 h-4"/></CardContent></Card></Link>)}
      {!loading && results.length===0 && <div className="border border-dashed p-10 text-center text-muted-foreground">Aucun résultat réel.</div>}
    </div>}
    <p className="text-xs text-muted-foreground">Approbations et Audit ne participent plus à la recherche globale : aucun endpoint de lecture réel n'existe actuellement pour ces domaines.</p>
  </div></Layout>;
}
