import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, DataLabel, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Lock, Activity, Eye, Users, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export default function Gouvernance() {
  const [tab, setTab] = useState<'humains' | 'agents' | 'audit'>('humains');
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(null);
  useEffect(() => {
    const replayId = new URLSearchParams(window.location.search).get('replay');
    if (replayId && FIXTURES.replay.some((item) => item.id === replayId)) {
      setSelectedReplayId(replayId);
      setTab('audit');
    }
  }, []);

  const selectedReplay = selectedReplayId ? FIXTURES.replay.find(r => r.id === selectedReplayId) : null;

  if (selectedReplay) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={() => {
            setSelectedReplayId(null);
            window.history.replaceState({}, '', '/gouvernance');
          }} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour au journal d'audit
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif">Trace de Décision (Replay)</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{selectedReplay.id}</Badge>
                <span className="text-xs font-mono text-muted-foreground">{selectedReplay.timestamp}</span>
              </div>
            </div>
            <Button onClick={() => toast({ title: 'Replay Initié', description: 'La décision est rejouée dans l\'environnement de test local.' })}>Simuler Replay Complet</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Contexte & Entrées</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DataLabel label="Inputs" value={selectedReplay.inputs} />
                <DataLabel label="Preuve / Ancrage" value={selectedReplay.evidence} />
                <DataLabel label="Modèle / Outil" value={selectedReplay.model} />
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="bg-primary/5"><CardTitle className="text-primary">Logique & Sortie</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DataLabel label="Règles Appliquées" value={selectedReplay.rules} />
                <DataLabel label="Décision (Sortie brute)" value={selectedReplay.decision} />
                <DataLabel label="Détail du Raisonnement" value={selectedReplay.details} />
                <DataLabel label="Résultat d'exécution" value={selectedReplay.result} className="text-primary" />
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-serif">Gouvernance & Audit</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Gestion des privilèges et traçabilité immuable</p>
          </div>
          <TabContainer>
            <TabButton 
              active={tab === 'humains'}
              onClick={() => setTab('humains')}
            >
              Humains
            </TabButton>
            <TabButton 
              active={tab === 'agents'}
              onClick={() => setTab('agents')}
            >
              Agents
            </TabButton>
            <TabButton 
              active={tab === 'audit'}
              onClick={() => setTab('audit')}
            >
              Audit / Replay
            </TabButton>
          </TabContainer>
        </header>

        {tab === 'humains' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border text-sm">
              <Users className="w-4 h-4 text-primary" /> 
              <span>Matrice des droits et délégations des opérateurs humains.</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FIXTURES.humans.map(hum => (
                <Card key={hum.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>{hum.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-1">{hum.role} • {hum.id}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">Droits Directs</span>
                      <div className="flex flex-wrap gap-2">
                        {hum.rights.map((r, i) => <Badge key={i} variant="outline">{r}</Badge>)}
                      </div>
                    </div>
                    {hum.delegations.length > 0 && (
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-primary block mb-2">Délégations Actives</span>
                        <ul className="text-xs space-y-1 text-primary">
                          {hum.delegations.map((d, i) => <li key={i}>• {d}</li>)}
                        </ul>
                      </div>
                    )}
                    {hum.restrictions.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-warning flex items-center gap-1 mb-2">
                          <AlertTriangle className="w-3 h-3" /> Restrictions
                        </span>
                        <ul className="text-xs space-y-1 text-warning-foreground">
                          {hum.restrictions.map((r, i) => <li key={i}>• {r}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-border flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toast({ title: 'Simulation Élévation', description: 'Mode R1 : Demande bloquée.' })}>Simuler Élévation A5</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === 'agents' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border text-sm">
              <Lock className="w-4 h-4 text-warning" /> 
              <span>Toute modification de capacité nécessite une élévation de privilège (A5 - Owner). L'environnement R1 est en lecture seule.</span>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Capacité</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Outil (Tool)</TableHead>
                    <TableHead>Risque</TableHead>
                    <TableHead>Niveau d'Approbation</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIXTURES.capabilities.map(cap => (
                    <TableRow key={cap.id}>
                      <TableCell className="font-mono text-xs">{cap.id}</TableCell>
                      <TableCell className="font-medium">{cap.agent}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{cap.tool}</TableCell>
                      <TableCell>
                        <Badge variant={cap.risk === 'R0' ? 'outline' : cap.risk === 'R2' ? 'warning' : 'destructive'}>{cap.risk}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{cap.approval}</TableCell>
                      <TableCell>
                        <Badge variant={cap.state === 'ACTIVE' ? 'success' : cap.state === 'SUSPENDED' ? 'destructive' : 'secondary'}>{cap.state}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Agent Suspendu', description: 'Simulation de suspension locale.' })}>Suspendre</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border text-sm">
              <Activity className="w-4 h-4 text-primary" /> 
              <span>Traçabilité immuable des décisions de l'essaim. Preuves cryptographiques désactivées en R1.</span>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Trace</TableHead>
                    <TableHead>Horodatage</TableHead>
                    <TableHead>Inputs</TableHead>
                    <TableHead>Décision</TableHead>
                    <TableHead>Preuves & Règles</TableHead>
                    <TableHead className="text-right">Replay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIXTURES.replay.map(rep => (
                    <TableRow key={rep.id} className="cursor-pointer hover:bg-muted/30" onClick={() => {
                      setSelectedReplayId(rep.id);
                      window.history.replaceState({}, '', `/gouvernance?replay=${rep.id}`);
                    }}>
                      <TableCell className="font-mono text-xs">{rep.id}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{rep.timestamp}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{rep.inputs}</TableCell>
                      <TableCell className="text-xs font-medium">{rep.decision}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {rep.rules} • {rep.evidence}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReplayId(rep.id);
                          window.history.replaceState({}, '', `/gouvernance?replay=${rep.id}`);
                        }}>
                          <Eye className="w-4 h-4 mr-2" /> Examiner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
