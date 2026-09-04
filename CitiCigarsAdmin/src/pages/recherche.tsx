import { useState } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardContent, Badge } from '@/components/ui/bespoke';
import { Input } from '@/components/ui/input';
import { FIXTURES } from '@/lib/fixtures';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

type SearchResult = {
  type: string;
  id: string;
  title: string;
  sub: string;
  link: string;
};

export default function Recherche() {
  const [query, setQuery] = useState('');

  const results: SearchResult[] = [];
  if (query.length > 2) {
    const q = query.toLowerCase();
    FIXTURES.clients.forEach(c => {
      if (c.identity.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) {
        results.push({ type: 'Client', id: c.id, title: c.identity.name, sub: c.identity.email, link: `/clients?id=${c.id}` });
      }
    });
    FIXTURES.stock.forEach(s => {
      if (s.sku.toLowerCase().includes(q) || s.type.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q)) {
        results.push({ type: 'Stock', id: s.sku, title: `${s.brand} - ${s.type}`, sub: `Lot: ${s.lot}`, link: `/stock?sku=${s.sku}` });
      }
    });
    FIXTURES.suppliers.forEach(s => {
      if (s.supplierName.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) {
        results.push({ type: 'Fournisseur', id: s.id, title: s.supplierName, sub: `Confiance: ${s.confidence}%`, link: `/fournisseurs?id=${s.id}` });
      }
    });
    FIXTURES.approvals.forEach(a => {
      if (
        a.id.toLowerCase().includes(q) ||
        a.object.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'Approbation',
          id: a.id,
          title: a.object,
          sub: `${a.category} · risque ${a.risk}`,
          link: `/approbations?id=${a.id}`,
        });
      }
    });
    FIXTURES.replay.forEach(r => {
      if (r.id.toLowerCase().includes(q) || r.decision.toLowerCase().includes(q)) {
        results.push({
          type: 'Audit',
          id: r.id,
          title: r.decision,
          sub: r.timestamp,
          link: `/gouvernance?replay=${r.id}`,
        });
      }
    });
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 max-w-3xl mx-auto mt-8">
        <header className="text-center mb-4">
          <h1 className="text-3xl font-serif tracking-tight">Recherche Globale</h1>
          <p className="text-muted-foreground text-sm font-mono mt-2 uppercase tracking-widest">
            Index des Signaux, Clients, Stocks et Gouvernance
          </p>
        </header>

        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            autoFocus
            className="pl-12 h-14 text-lg border-2 border-border focus-visible:border-primary bg-card"
            placeholder="Entrez un SKU, un nom de client, un ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.length > 2 && (
          <div className="space-y-3 mt-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              {results.length} Résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
            </p>
            {results.map((r, i) => (
              <Link key={i} href={r.link} className="block group">
                <Card className="group-hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{r.type}</Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{r.id}</span>
                      </div>
                      <p className="font-medium text-lg mt-1">{r.title}</p>
                      <p className="text-sm text-muted-foreground">{r.sub}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border">
                Aucun résultat pour "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
