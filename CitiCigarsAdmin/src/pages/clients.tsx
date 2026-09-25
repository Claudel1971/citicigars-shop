import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TabContainer, TabButton } from '@/components/ui/bespoke';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

function money(value: unknown) { return new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA'; }

export default function Clients() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('id'));
  const [tab, setTab] = useState<'infos'|'adn'|'commandes'|'interactions'>('infos');

  const list = useQuery({ queryKey:['customers',search], queryFn:()=>api.customers(search) });
  const detail = useQuery({ queryKey:['customer',selectedId], queryFn:()=>api.customer(selectedId!), enabled:Boolean(selectedId) });

  useEffect(()=>{ if (selectedId) window.history.replaceState({},'',`/clients?id=${selectedId}`); else window.history.replaceState({},'','/clients'); },[selectedId]);

  if (selectedId) {
    const d=detail.data;
    const c=d?.customer;
    return <Layout><div className="space-y-6">
      <button onClick={()=>setSelectedId(null)} className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><ArrowLeft className="w-4 h-4"/>Retour à la liste</button>
      {detail.isLoading && <p>Chargement…</p>}
      {detail.error && <p className="text-destructive">Client indisponible.</p>}
      {c && <>
        <header><h1 className="text-3xl font-serif">{[c.firstName,c.lastName].filter(Boolean).join(' ') || c.companyName || c.customerId}</h1><div className="flex gap-2 mt-2"><Badge variant="outline">{c.customerId}</Badge><Badge variant="secondary">{c.customerType || '—'}</Badge><Badge variant={c.status==='ACTIVE'?'success':'outline'}>{c.status || '—'}</Badge></div></header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Commandes</p><p className="text-xl">{d.summary?.orderCount ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">CA cumulé</p><p className="text-xl">{money(d.summary?.totalRevenueXaf)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Panier moyen</p><p className="text-xl">{money(d.summary?.averageBasketXaf)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Dernière commande</p><p className="text-sm">{d.summary?.lastOrderDate ? new Date(d.summary.lastOrderDate).toLocaleDateString('fr-FR') : '—'}</p></CardContent></Card>
        </div>
        <TabContainer><TabButton active={tab==='infos'} onClick={()=>setTab('infos')}>Identité & Contact</TabButton><TabButton active={tab==='adn'} onClick={()=>setTab('adn')}>ADN</TabButton><TabButton active={tab==='commandes'} onClick={()=>setTab('commandes')}>Commandes</TabButton><TabButton active={tab==='interactions'} onClick={()=>setTab('interactions')}>Interactions</TabButton></TabContainer>
        {tab==='infos' && <Card><CardHeader><CardTitle>Informations réelles</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-3 text-sm"><div>Email: {c.email || '—'}</div><div>WhatsApp: {c.phoneWhatsapp || '—'}</div><div>Entreprise: {c.companyName || '—'}</div><div>Solde dû: {money(c.balanceDueXaf)}</div></CardContent></Card>}
        {tab==='adn' && <Card><CardContent className="p-5"><pre className="text-xs whitespace-pre-wrap">{d.dna ? JSON.stringify(d.dna,null,2) : 'Aucun résultat DNA réel enregistré.'}</pre></CardContent></Card>}
        {tab==='commandes' && <Card><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{(d.orders||[]).map((o:any)=><TableRow key={o.orderId}><TableCell className="font-mono text-xs">{o.orderId}</TableCell><TableCell>{o.orderDate ? new Date(o.orderDate).toLocaleDateString('fr-FR'):'—'}</TableCell><TableCell>{money(o.finalSaleTotalXaf)}</TableCell><TableCell>{o.status || '—'}</TableCell></TableRow>)}</TableBody></Table></Card>}
        {tab==='interactions' && <Card><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Résumé</TableHead></TableRow></TableHeader><TableBody>{(d.interactions||[]).map((i:any)=><TableRow key={i.interactionId}><TableCell>{i.interactionDate ? new Date(i.interactionDate).toLocaleString('fr-FR'):'—'}</TableCell><TableCell>{i.interactionType || i.sourceType || '—'}</TableCell><TableCell>{i.summary || i.notes || i.content || '—'}</TableCell></TableRow>)}</TableBody></Table></Card>}
      </>}
    </div></Layout>;
  }

  return <Layout><div className="space-y-6">
    <header><h1 className="text-3xl font-serif">Clients 360</h1><p className="text-sm text-muted-foreground mt-2">Source réelle : CRM.</p></header>
    <Input placeholder="Rechercher un client…" value={search} onChange={e=>setSearch(e.target.value)} />
    {list.isLoading && <p>Chargement…</p>}
    {list.error && <p className="text-destructive">Impossible de charger les clients.</p>}
    <Card><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Client</TableHead><TableHead>Type</TableHead><TableHead>WhatsApp</TableHead><TableHead>Solde dû</TableHead></TableRow></TableHeader><TableBody>{(list.data||[]).map((c:any)=><TableRow key={c.customerId} className="cursor-pointer" onClick={()=>setSelectedId(c.customerId)}><TableCell className="font-mono text-xs">{c.customerId}</TableCell><TableCell>{[c.firstName,c.lastName].filter(Boolean).join(' ') || c.companyName || '—'}</TableCell><TableCell>{c.customerType || '—'}</TableCell><TableCell>{c.phoneWhatsapp || '—'}</TableCell><TableCell>{money(c.balanceDueXaf)}</TableCell></TableRow>)}</TableBody></Table></Card>
    <p className="text-xs text-muted-foreground">CLOSE-02 reste en lecture seule côté Admin : création/modification/blacklist ne sont pas raccordées ici, même si les endpoints d'écriture existent.</p>
  </div></Layout>;
}
