import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/bespoke';
import { Lock } from 'lucide-react';

export default function Page() {
  return <Layout><div className="space-y-6">
    <header><h1 className="text-3xl font-serif">Centre d'Approbation</h1><p className="text-sm text-muted-foreground mt-2">CLOSE-02 — état réel du raccordement.</p></header>
    <Card className="border-warning/30"><CardContent className="p-6 flex gap-3"><Lock className="w-5 h-5 text-warning shrink-0"/><div className="space-y-2"><p className="font-medium">Non connectable sans nouveau backend</p><p className="text-sm text-muted-foreground">Le RBAC définit approvals:read et approvals:decide, mais le dépôt ne fournit actuellement aucun endpoint de lecture du registre d'approbations. Créer ce registre ou ses routes relèverait d'un autre CLOSE item.</p><p className="text-sm text-muted-foreground">Les anciennes données de démonstration ont été retirées pour éviter de les présenter comme réelles. Aucun mécanisme R1 n'est levé par CLOSE-02.</p></div></CardContent></Card>
  </div></Layout>;
}
