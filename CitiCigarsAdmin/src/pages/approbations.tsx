import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, DataLabel, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { ShieldCheck, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const CATEGORIES = ['Tous', 'Agents', 'Achats', 'Campagnes', 'CRM', 'Stock', 'Autres'] as const;
type SummaryFilter = 'all' | 'risk' | 'urgent' | 'agents';

export default function Approbations() {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('Tous');
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all');
  
  const approvals = FIXTURES.approvals;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && FIXTURES.approvals.some(a => a.id === idParam)) {
      setSelectedAppId(idParam);
    }
  }, []);

  const handleClearSelection = () => {
    setSelectedAppId(null);
    window.history.replaceState({}, '', '/approbations');
  };

  const handleSelectApp = (id: string) => {
    setSelectedAppId(id);
    window.history.replaceState({}, '', `/approbations?id=${id}`);
  };

  const filteredApprovals = approvals.filter((approval) => {
    const categoryMatch = activeCategory === 'Tous' || approval.category === activeCategory;
    const summaryMatch =
      summaryFilter === 'all' ||
      (summaryFilter === 'risk' && (approval.risk === 'Critique' || approval.risk === 'Élevé')) ||
      (summaryFilter === 'urgent' && approval.expiration.includes('heures')) ||
      (summaryFilter === 'agents' && approval.category === 'Agents');
    return categoryMatch && summaryMatch;
  });

  const selectSummary = (filter: SummaryFilter) => {
    setSummaryFilter(filter);
    setActiveCategory(filter === 'agents' ? 'Agents' : 'Tous');
  };

  const selectedApp = selectedAppId ? approvals.find(a => a.id === selectedAppId) : null;

  if (selectedApp) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={handleClearSelection} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux approbations
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif">Décision Requise</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{selectedApp.id}</Badge>
                <Badge variant={selectedApp.level === 'A5' ? 'destructive' : selectedApp.level === 'A4' ? 'warning' : 'secondary'}>
                  Niveau {selectedApp.level}
                </Badge>
                <Badge variant="secondary">{selectedApp.category}</Badge>
                <Badge variant={selectedApp.risk === 'Critique' || selectedApp.risk === 'Élevé' ? 'destructive' : 'outline'}>
                  Risque {selectedApp.risk}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-warning flex items-center gap-1 justify-end"><ShieldAlert className="w-3 h-3" /> {selectedApp.expiration}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Objet de la demande</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DataLabel label="Demandeur" value={selectedApp.requester} />
                <DataLabel label="Objet" value={selectedApp.object} className="text-lg" />
                {selectedApp.amount && <DataLabel label="Montant Impliqué" value={selectedApp.amount} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Preuves & Justifications</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {selectedApp.evidence.map((ev, i) => (
                    <li key={i} className="p-3 border border-border bg-muted/10 text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" /> {ev}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 border-2 border-destructive bg-destructive/10 flex flex-col md:flex-row items-center justify-between gap-4 rounded-sm">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-destructive" />
              <div>
                <p className="text-sm font-bold text-destructive uppercase tracking-wide">Exécution bloquée (Environnement R1)</p>
                <p className="text-xs font-mono text-destructive/80 mt-1">Le système est en mode audit (lecture seule). Les mutations sont désactivées.</p>
              </div>
            </div>
            <div className="flex gap-4 opacity-50 pointer-events-none grayscale">
              <Button variant="outline" className="border-destructive text-destructive">Rejeter la demande</Button>
              <Button variant="default" className="bg-success text-success-foreground">Approuver</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-serif">Centre d'Approbation</h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Contrôle des décisions d'agents et flux critiques</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button type="button" onClick={() => selectSummary('all')} className="text-left">
          <Card className={`h-full transition-colors hover:border-primary ${summaryFilter === 'all' ? 'border-primary bg-primary/5' : 'border-primary/20'}`}>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase font-mono text-primary tracking-widest mb-1">Total en attente</p>
              <p className="text-3xl font-serif">{approvals.length}</p>
            </CardContent>
          </Card>
          </button>
          <button type="button" onClick={() => selectSummary('risk')} className="text-left">
          <Card className={`h-full transition-colors hover:border-destructive ${summaryFilter === 'risk' ? 'border-destructive bg-destructive/5' : ''}`}>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase font-mono text-destructive tracking-widest mb-1">Risque Critique/Élevé</p>
              <p className="text-3xl font-serif">{approvals.filter(a => a.risk === 'Critique' || a.risk === 'Élevé').length}</p>
            </CardContent>
          </Card>
          </button>
          <button type="button" onClick={() => selectSummary('urgent')} className="text-left">
          <Card className={`h-full transition-colors hover:border-warning ${summaryFilter === 'urgent' ? 'border-warning bg-warning/5' : ''}`}>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase font-mono text-warning tracking-widest mb-1">Expiration Proche</p>
              <p className="text-3xl font-serif">{approvals.filter(a => a.expiration.includes('heures')).length}</p>
            </CardContent>
          </Card>
          </button>
          <button type="button" onClick={() => selectSummary('agents')} className="text-left">
          <Card className={`h-full transition-colors hover:border-primary ${summaryFilter === 'agents' ? 'border-primary bg-primary/5' : ''}`}>
            <CardContent className="p-4">
              <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Requêtes Agents</p>
              <p className="text-3xl font-serif">{approvals.filter(a => a.category === 'Agents').length}</p>
            </CardContent>
          </Card>
          </button>
        </div>

        <TabContainer className="w-full mt-6 mb-4">
          {CATEGORIES.map(cat => (
            <TabButton 
              key={cat}
              active={activeCategory === cat}
              onClick={() => {
                setActiveCategory(cat);
                setSummaryFilter(cat === 'Agents' ? 'agents' : 'all');
              }}
            >
              {cat}
              {cat !== 'Tous' && (
                <span className="ml-2 text-[10px] opacity-70">
                  {approvals.filter((approval) => approval.category === cat).length}
                </span>
              )}
            </TabButton>
          ))}
        </TabContainer>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Risque / Niveau</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Urgence</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApprovals.map(app => (
                <TableRow key={app.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectApp(app.id)}>
                  <TableCell className="font-mono text-xs">{app.id}</TableCell>
                  <TableCell className="text-xs">{app.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={app.level === 'A5' ? 'destructive' : app.level === 'A4' ? 'warning' : 'outline'} className="w-fit">{app.level}</Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">{app.risk}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{app.requester}</TableCell>
                  <TableCell className="font-medium text-sm truncate max-w-[200px]">{app.object}</TableCell>
                  <TableCell className="text-xs font-mono text-warning">{app.expiration}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectApp(app.id); }}>Examiner</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredApprovals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground border-dashed">
                    Aucune approbation dans cette catégorie.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Layout>
  );
}
