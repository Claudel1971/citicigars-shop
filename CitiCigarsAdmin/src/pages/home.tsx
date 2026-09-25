import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/bespoke';
import { api } from '@/lib/api';
import { Users, Package, Truck, Clock } from 'lucide-react';

export default function Home() {
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => api.customers() });
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => api.stock() });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api.suppliers() });
  const followups = useQuery({ queryKey: ['followups'], queryFn: () => api.followups() });

  const cards = [
    ['Clients', customers.data?.length ?? 0, Users],
    ['Positions stock', stock.data?.positions?.length ?? 0, Package],
    ['Fournisseurs', suppliers.data?.suppliers?.length ?? 0, Truck],
    ['Relances ouvertes', followups.data?.length ?? 0, Clock],
  ] as const;

  const loading = customers.isLoading || stock.isLoading || suppliers.isLoading || followups.isLoading;
  const error = customers.error || stock.error || suppliers.error || followups.error;

  return <Layout>
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-serif">Vue d'ensemble</h1>
        <p className="text-sm text-muted-foreground mt-2">Données opérationnelles réelles — lecture seule CLOSE-02.</p>
      </header>
      {error && <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Une ou plusieurs sources réelles sont indisponibles.</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map(([label,value,Icon]) => <Card key={label}><CardContent className="p-4 flex justify-between items-center">
          <div><p className="text-[10px] uppercase font-mono text-muted-foreground">{label}</p><p className="text-2xl font-serif mt-1">{loading ? '…' : value}</p></div>
          <Icon className="w-7 h-7 text-muted-foreground/40" />
        </CardContent></Card>)}
      </div>
      <Card><CardContent className="p-5 text-sm text-muted-foreground">
        Les anciens « signaux prioritaires », « décisions automatisées » et « approbations en attente » provenaient de fixtures. Aucun endpoint réel correspondant n'existe actuellement : ils ne sont donc plus affichés comme données réelles.
      </CardContent></Card>
    </div>
  </Layout>;
}
