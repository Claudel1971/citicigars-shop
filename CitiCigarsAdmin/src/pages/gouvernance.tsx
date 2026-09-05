import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, DataLabel, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Lock, Activity, Eye, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export default function Gouvernance() {
  const [tab, setTab] = useState<'employes' | 'agents' | 'audit'>('employes');
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(null);

  // Operator create form
  const [empForm, setEmpForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', identifier: '', startDate: '', role: 'Opérateur', active: 'true', rights: '' });

  // Agent create form
  const [agentForm, setAgentForm] = useState({ name: '', identifier: '', role: '', capabilities: '', permissions: '', authLevel: 'A3', state: 'ACTIVE' });

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
            <h1 className="text-3xl font-serif">Gouvernance & Sécurité</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Administration des comptes et traçabilité immuable</p>
          </div>
          <TabContainer>
            <TabButton active={tab === 'employes'} onClick={() => setTab('employes')}>Employés</TabButton>
            <TabButton active={tab === 'agents'} onClick={() => setTab('agents')}>Agents</TabButton>
            <TabButton active={tab === 'audit'} onClick={() => setTab('audit')}>Audit / Replay</TabButton>
          </TabContainer>
        </header>

        {tab === 'employes' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border text-sm">
              <Users className="w-4 h-4 text-primary" /> 
              <span>Administration centralisée des comptes opérateurs. Simulation locale : les données ne sont pas persistées.</span>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Email / Contact</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right min-w-[300px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIXTURES.employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-xs">{emp.identifier}</TableCell>
                      <TableCell className="font-medium">
                        {emp.firstName} {emp.lastName}
                        {emp.id === 'EMP-001' && <Badge variant="default" className="ml-2 bg-primary">Tous les droits</Badge>}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{emp.role}</Badge></TableCell>
                      <TableCell>
                        <div className="text-xs">{emp.email}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{emp.phone}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.active ? 'success' : 'destructive'}>{emp.active ? 'Actif' : 'Inactif'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Édition simulée', description: 'Modification des permissions...' })}>Éditer</Button>
                          <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Réinitialisation', description: 'Lien de reset sécurisé généré, sans mot de passe en clair.' })}>Reset Sécurisé</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => toast({ title: 'Révocation', description: 'Accès désactivé (Simulation R1).' })}>Désactiver</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card className="max-w-3xl border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-primary">Créer un compte opérateur (Simulation)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">L'initialisation génère un lien sécurisé d'activation. Aucun mot de passe en clair n'est stocké.</p>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  toast({ title: 'Simulation', description: 'Un lien d\'initialisation sécurisé a été généré localement.' });
                  setEmpForm({ firstName: '', lastName: '', email: '', phone: '', address: '', identifier: '', startDate: '', role: 'Opérateur', active: 'true', rights: '' });
                }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Prénom</label>
                      <Input placeholder="Prénom" value={empForm.firstName} onChange={e => setEmpForm(prev => ({...prev, firstName: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Nom</label>
                      <Input placeholder="Nom" value={empForm.lastName} onChange={e => setEmpForm(prev => ({...prev, lastName: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email pro</label>
                      <Input type="email" placeholder="email@citicigars.com" value={empForm.email} onChange={e => setEmpForm(prev => ({...prev, email: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Téléphone</label>
                      <Input placeholder="+33 6..." value={empForm.phone} onChange={e => setEmpForm(prev => ({...prev, phone: e.target.value}))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Adresse complète</label>
                      <Input placeholder="10 Place..." value={empForm.address} onChange={e => setEmpForm(prev => ({...prev, address: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Identifiant Unique</label>
                      <Input placeholder="OP-001" value={empForm.identifier} onChange={e => setEmpForm(prev => ({...prev, identifier: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Date de début</label>
                      <Input type="date" value={empForm.startDate} onChange={e => setEmpForm(prev => ({...prev, startDate: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Rôle principal</label>
                      <select className="h-10 w-full border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary" value={empForm.role} onChange={e => setEmpForm(prev => ({...prev, role: e.target.value}))}>
                        <option>Opérateur</option>
                        <option>Valideur Niveau 1</option>
                        <option>Administrateur</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Statut</label>
                      <select className="h-10 w-full border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary" value={empForm.active} onChange={e => setEmpForm(prev => ({...prev, active: e.target.value}))}>
                        <option value="true">Actif</option>
                        <option value="false">Inactif</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Droits / Privilèges supplémentaires (séparés par virgule)</label>
                      <textarea className="w-full border border-border bg-card p-3 text-sm min-h-[80px] focus:outline-none focus:border-primary" placeholder="Accès A3, Audit, ..." value={empForm.rights} onChange={e => setEmpForm(prev => ({...prev, rights: e.target.value}))} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Générer lien d'activation local</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'agents' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border text-sm">
              <Lock className="w-4 h-4 text-warning" /> 
              <span>Administration locale des agents de l'essaim. Toute modification réelle nécessite une élévation de privilège (A5 - Owner).</span>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Capacité</TableHead>
                    <TableHead>Nom Agent</TableHead>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Configuration', description: 'Ouverture du panneau IA...' })}>Configurer</Button>
                          <Button variant="ghost" size="sm" className="text-warning hover:text-warning hover:bg-warning/10" onClick={() => toast({ title: 'Agent Suspendu', description: 'Agent mis en veille locale.' })}>Suspendre</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => toast({ title: 'Agent Désactivé', description: 'Simulation de désactivation (A5 requis).' })}>Désactiver</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card className="max-w-3xl">
              <CardHeader className="bg-muted/10">
                <CardTitle>Configurer / Enregistrer un Agent (Simulation)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Définissez les garde-fous locaux de la nouvelle capacité.</p>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  toast({ title: 'Agent Configuré', description: 'Configuration locale générée (requiert A5 pour R2).' });
                  setAgentForm({ name: '', identifier: '', role: '', capabilities: '', permissions: '', authLevel: 'A3', state: 'ACTIVE' });
                }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Nom Agent</label>
                      <Input placeholder="ex: Supplier Watcher" value={agentForm.name} onChange={e => setAgentForm(prev => ({...prev, name: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Identifiant Unique</label>
                      <Input placeholder="CAP-..." value={agentForm.identifier} onChange={e => setAgentForm(prev => ({...prev, identifier: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Rôle / Outil</label>
                      <Input placeholder="ex: inventory.mutate" value={agentForm.role} onChange={e => setAgentForm(prev => ({...prev, role: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Niveau Auth</label>
                      <select className="h-10 w-full border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary" value={agentForm.authLevel} onChange={e => setAgentForm(prev => ({...prev, authLevel: e.target.value}))}>
                        <option>A1 (Auto)</option>
                        <option>A3 (Lecture)</option>
                        <option>A4 (Mutation)</option>
                        <option>A5 (Critique)</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Permissions & Capacités</label>
                      <textarea className="w-full border border-border bg-card p-3 text-sm min-h-[80px] focus:outline-none focus:border-primary" placeholder="Lecture DB locale, ..." value={agentForm.permissions} onChange={e => setAgentForm(prev => ({...prev, permissions: e.target.value}))} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">Enregistrer Configuration IA</Button>
                </form>
              </CardContent>
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
