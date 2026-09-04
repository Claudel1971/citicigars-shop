import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, DataLabel, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Check, X, ShieldAlert, ArrowLeft, Search } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export default function Clients() {
  const [tab, setTab] = useState<'consulter' | 'creer'>('consulter');
  const [detailTab, setDetailTab] = useState<'infos' | 'historique' | 'communications'>('infos');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Simulate creation state
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', preferences: '' });
  const [simState, setSimState] = useState<'idle'|'confirm'|'success'>('idle');

  // Read URL query parameter for direct link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && FIXTURES.clients.some(c => c.id === idParam)) {
      setSelectedClientId(idParam);
      setTab('consulter');
    }
  }, []);

  const handleClearSelection = () => {
    setSelectedClientId(null);
    window.history.replaceState({}, '', '/clients');
  };

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    setDetailTab('infos');
    window.history.replaceState({}, '', `/clients?id=${id}`);
  };

  const selectedClient = selectedClientId ? FIXTURES.clients.find(c => c.id === selectedClientId) : null;

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast({ title: 'Erreur', description: 'Nom et Email requis.', variant: 'destructive' });
      return;
    }
    setSimState('confirm');
  };

  const handleConfirm = () => {
    setSimState('success');
    toast({ title: 'Succès simulé', description: 'Le client serait enregistré en base (Mode R1).' });
    setTimeout(() => {
      setSimState('idle');
      setFormData({ name: '', email: '', phone: '', preferences: '' });
      setTab('consulter');
    }, 2500);
  };

  const filteredClients = FIXTURES.clients.filter(c => 
    c.identity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.identity.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedClient) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={handleClearSelection} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour à la liste
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif">{selectedClient.identity.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{selectedClient.id}</Badge>
                {selectedClient.ctcgLinked ? (
                  <Badge variant="success" className="flex gap-1 items-center"><Check className="w-3 h-3"/> Compte Lié</Badge>
                ) : (
                  <Badge variant="warning" className="flex gap-1 items-center"><X className="w-3 h-3"/> Non Lié</Badge>
                )}
              </div>
            </div>
            <Button variant="outline" disabled title="Export désactivé dans R1">Exporter le rapport (désactivé)</Button>
          </div>

          <div className="mt-8">
            <TabContainer className="mb-6">
              <TabButton active={detailTab === 'infos'} onClick={() => setDetailTab('infos')}>Infos & ADN</TabButton>
              <TabButton active={detailTab === 'historique'} onClick={() => setDetailTab('historique')}>Historique (Commandes & Interactions)</TabButton>
              <TabButton active={detailTab === 'communications'} onClick={() => setDetailTab('communications')}>Brouillon Communication</TabButton>
            </TabContainer>

            {detailTab === 'infos' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Lifetime Value</p>
                      <p className="text-2xl font-serif text-primary">{formatFCFA(selectedClient.kpis.lifetimeValueXAF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Commandes</p>
                      <p className="text-2xl font-serif">{selectedClient.kpis.totalOrders}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Panier Moyen</p>
                      <p className="text-2xl font-serif">{formatFCFA(selectedClient.kpis.averageOrderValueXAF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Dernière Commande</p>
                      <p className="text-2xl font-serif">{selectedClient.kpis.lastOrderDate}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader><CardTitle>Identité & Contact</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <DataLabel label="Email" value={selectedClient.identity.email} />
                      <DataLabel label="Téléphone" value={selectedClient.identity.phone || 'Non renseigné'} />
                      <DataLabel label="Activité Récente" value={selectedClient.activity} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>ADN & Préférences (Déduit)</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedClient.dna.map((trait, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                            {trait}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-primary/20">
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="text-primary">Recommandations (Next-Best-Action)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU Cible</TableHead>
                          <TableHead>Disponibilité</TableHead>
                          <TableHead>Source d'inférence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClient.recommendations.map((rec, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs font-medium">{rec.sku}</TableCell>
                            <TableCell>{rec.availability}</TableCell>
                            <TableCell className="text-muted-foreground italic text-xs">{rec.source}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {detailTab === 'historique' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Commandes</CardTitle></CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClient.orders.map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.date}</TableCell>
                          <TableCell className="font-medium">{formatFCFA(o.totalXAF)}</TableCell>
                          <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {selectedClient.orders.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Aucune commande</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Interactions</CardTitle></CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Résumé</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClient.interactions.map((inter, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{inter.date}</TableCell>
                          <TableCell><Badge variant="secondary">{inter.type}</Badge></TableCell>
                          <TableCell className="text-xs">{inter.summary}</TableCell>
                        </TableRow>
                      ))}
                      {selectedClient.interactions.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Aucune interaction</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}

            {detailTab === 'communications' && (
              <Card className="max-w-2xl border-primary/20">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-primary">Créer un brouillon (Local)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Canal</label>
                    <select className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm">
                      <option>WhatsApp</option>
                      <option>Email</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Message</label>
                    <textarea className="flex min-h-[120px] w-full border border-input bg-background px-3 py-2 text-sm" placeholder={`Cher ${selectedClient.identity.name}...`} />
                  </div>
                  <Button className="w-full mt-4" onClick={(e) => { e.preventDefault(); toast({ title: 'Brouillon sauvegardé', description: 'Enregistré localement. Mutation R1 bloquée.' }); }}>Enregistrer Brouillon</Button>
                </CardContent>
              </Card>
            )}
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
            <h1 className="text-3xl font-serif">Clients 360</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Base de connaissances & ADN</p>
          </div>
          <TabContainer>
            <TabButton active={tab === 'consulter'} onClick={() => setTab('consulter')}>
              Consulter
            </TabButton>
            <TabButton active={tab === 'creer'} onClick={() => setTab('creer')}>
              Créer (Simulation locale)
            </TabButton>
          </TabContainer>
        </header>

        {tab === 'consulter' && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Rechercher par nom, email ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Activité</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map(client => (
                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectClient(client.id)}>
                      <TableCell className="font-mono text-xs">{client.id}</TableCell>
                      <TableCell className="font-medium">{client.identity.name}</TableCell>
                      <TableCell>
                        {client.ctcgLinked ? <Badge variant="success">Lié</Badge> : <Badge variant="warning">Isolé</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{client.activity}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectClient(client.id); }}>Détails</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground border-dashed">
                        Aucun client trouvé.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {tab === 'creer' && (
          <div className="max-w-xl">
            <Card className="border-warning/50">
              <CardHeader className="bg-warning/10 border-warning/20">
                <CardTitle className="text-warning flex items-center gap-2">
                   <ShieldAlert className="w-4 h-4" /> Bac à sable de création
                </CardTitle>
                <p className="text-xs text-warning/80">Validation locale uniquement. Aucune mutation vers la base de données.</p>
              </CardHeader>
              <CardContent className="pt-6">
                {simState === 'idle' && (
                  <form onSubmit={handleSimulate} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest">Nom complet</label>
                      <Input value={formData.name} onChange={e => setFormData(prev => ({...prev, name: e.target.value}))} placeholder="ex: Jean Dupont" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest">Email</label>
                      <Input type="email" value={formData.email} onChange={e => setFormData(prev => ({...prev, email: e.target.value}))} placeholder="ex: jean@example.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest">Téléphone (Optionnel)</label>
                      <Input value={formData.phone} onChange={e => setFormData(prev => ({...prev, phone: e.target.value}))} placeholder="ex: +33 6 00..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest">Notes / Préférences brutes</label>
                      <textarea 
                        className="flex min-h-[80px] w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                        value={formData.preferences} 
                        onChange={e => setFormData(prev => ({...prev, preferences: e.target.value}))}
                        placeholder="Le modèle IA extraira l'ADN depuis ces notes..."
                      />
                    </div>
                    <Button type="submit" className="w-full mt-4">Valider & Simuler l'Extraction</Button>
                  </form>
                )}
                
                {simState === 'confirm' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-muted p-4 border border-border">
                      <h4 className="font-serif text-lg mb-2">Récapitulatif (Extraction Simulée)</h4>
                      <DataLabel label="Nom" value={formData.name} className="mb-2" />
                      <DataLabel label="Email" value={formData.email} className="mb-2" />
                      <div className="mt-4">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">ADN Déduit (Simulation)</span>
                        <ul className="list-disc list-inside text-sm mt-1 text-primary">
                          <li>Nouveau prospect</li>
                          <li>Intérêt potentiel : {formData.preferences ? 'Analyse des notes simulée' : 'Non qualifié'}</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setSimState('idle')} className="flex-1">Modifier</Button>
                      <Button variant="default" onClick={handleConfirm} className="flex-1">Confirmer la Création (Local)</Button>
                    </div>
                  </div>
                )}

                {simState === 'success' && (
                  <div className="text-center py-12 animate-in zoom-in-95">
                    <div className="w-12 h-12 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-serif text-success">Client Simulé avec Succès</h3>
                    <p className="text-muted-foreground text-sm mt-2">Retour au formulaire...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
