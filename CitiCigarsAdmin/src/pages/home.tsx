import { Layout } from '@/components/layout';
import { Card, CardContent, Badge } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Activity, ShieldAlert, Clock, Info, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export default function Home() {
  const highPrioritySignals = FIXTURES.signals.filter(s => s.priority === 'HAUTE');
  const pendingApprovals = FIXTURES.approvals.filter(a => a.state === 'REQUIERT_DÉCISION');

  const getSignalLink = (type: string, id: string) => {
    switch(type) {
      case 'STOCK': return `/stock?sku=${id}`;
      case 'FOURNISSEUR': return `/fournisseurs?id=${id}`;
      case 'CLIENT': return `/clients?id=${id}`;
      default: return `/recherche`;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="text-3xl font-serif tracking-tight">Vue d'ensemble</h1>
          <p className="text-muted-foreground text-sm font-mono mt-2 uppercase tracking-widest">
            Aujourd'hui — Poste de commandement
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-mono text-primary/70 tracking-widest">Signaux Actifs</p>
                <p className="text-2xl font-serif text-primary mt-1">{FIXTURES.signals.filter(s => s.state === 'ACTIF').length}</p>
              </div>
              <Activity className="w-8 h-8 text-primary/40" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest">Approbations En Attente</p>
                <p className="text-2xl font-serif mt-1">{pendingApprovals.length}</p>
              </div>
              <ShieldAlert className="w-8 h-8 text-muted-foreground/40" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest">Décisions Automatisées (24h)</p>
                <p className="text-2xl font-serif mt-1">14</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground/40" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-serif">Signaux Prioritaires</h2>
              <Link href="/recherche" className="text-xs text-primary hover:underline font-mono uppercase tracking-widest">Voir tous</Link>
            </div>
            {highPrioritySignals.map(signal => (
              <Card key={signal.id} className="border-l-4 border-l-destructive">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="destructive">{signal.priority}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{signal.freshness}</span>
                  </div>
                  <h3 className="font-medium text-base">{signal.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{signal.reason}</p>
                  
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono bg-muted/50 p-2 border border-border/50">
                      <Info className="w-3 h-3" /> Source: {signal.source}
                    </div>
                    <Link href={getSignalLink(signal.targetType, signal.targetId)} className="inline-flex items-center justify-between text-xs h-8 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium w-full mt-2">
                      <span>Inspecter {signal.targetType} ({signal.targetId})</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-serif">Approbations Requises</h2>
              <Link href="/approbations" className="text-xs text-primary hover:underline font-mono uppercase tracking-widest">Gérer</Link>
            </div>
            <div className="space-y-3">
              {pendingApprovals.slice(0, 3).map(approval => (
                <Card key={approval.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={approval.level === 'A5' ? 'destructive' : approval.level === 'A4' ? 'warning' : 'outline'}>
                        Niveau {approval.level}
                      </Badge>
                      <span className="text-xs text-warning font-mono">{approval.expiration}</span>
                    </div>
                    <p className="font-medium text-sm mt-2">{approval.object}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">Demandeur: {approval.requester}</p>
                    
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Preuves Jointes</p>
                      {approval.evidence.slice(0,2).map((ev, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ShieldCheck className="w-3.5 h-3.5 text-primary/70" />
                          <span className="truncate">{ev}</span>
                        </div>
                      ))}
                      {approval.evidence.length > 2 && (
                        <div className="text-xs text-muted-foreground italic pl-5">+{approval.evidence.length - 2} autres</div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Link href={`/approbations?id=${approval.id}`} className="inline-flex items-center justify-center text-xs h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium w-full">Examiner</Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
