import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, DataLabel, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Search } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export default function Clients() {
  const [tab, setTab] = useState<'consulter' | 'creer'>('consulter');
  const [detailTab, setDetailTab] = useState<'infos' | 'adn' | 'commandes' | 'interactions'>('infos');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Simulate creation state
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '', city: '', preferences: '' });

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
    if (!formData.lastName || !formData.email) {
      toast({ title: 'Erreur', description: 'Nom et Email requis.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Simulation locale', description: 'Client sauvegardé en mémoire (Mode R1).' });
    setFormData({ firstName: '', lastName: '', email: '', phone: '', city: '', preferences: '' });
    setTab('consulter');
  };

  const filteredClients = FIXTURES.clients.filter(c => 
    c.identity.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.identity.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
              <h1 className="text-3xl font-serif">{selectedClient.identity.firstName} {selectedClient.identity.lastName}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{selectedClient.id}</Badge>
                <Badge variant={selectedClient.type === 'B2B' ? 'secondary' : 'default'}>{selectedClient.type}</Badge>
                <Badge variant={selectedClient.status === 'Actif' ? 'success' : selectedClient.status === 'Blacklisté' ? 'destructive' : 'warning'}>{selectedClient.status}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast({ title: 'Mode édition', description: 'Ouverture du formulaire de modification (Simulation).' })}>Modifier</Button>
              <Button variant="outline" className="text-warning border-warning hover:bg-warning hover:text-warning-foreground" onClick={() => toast({ title: 'Archivage simulé', description: "Le client est désactivé et archivé. Aucune suppression physique de l'historique." })}>Archiver / Désactiver</Button>
              <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => toast({ title: 'Mise sur liste noire', description: 'Client blacklisté. Les futures transactions seront bloquées (Simulation R1).' })}>Blacklister</Button>
            </div>
          </div>

          <div className="mt-8">
            <TabContainer className="mb-6">
              <TabButton active={detailTab === 'infos'} onClick={() => setDetailTab('infos')}>Identité & Contact</TabButton>
              <TabButton active={detailTab === 'adn'} onClick={() => setDetailTab('adn')}>ADN & Préférences</TabButton>
              <TabButton active={detailTab === 'commandes'} onClick={() => setDetailTab('commandes')}>Commandes</TabButton>
              <TabButton active={detailTab === 'interactions'} onClick={() => setDetailTab('interactions')}>Interactions / Communication</TabButton>
            </TabContainer>

            {detailTab === 'infos' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Score IA</p>
                      <p className="text-2xl font-serif text-primary">{selectedClient.score} / 100</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Commandes</p>
                      <p className="text-xl font-serif">{selectedClient.kpis.totalOrders}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">CA Cumulé</p>
                      <p className="text-xl font-serif">{formatFCFA(selectedClient.kpis.lifetimeValueXAF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Panier Moyen</p>
                      <p className="text-xl font-serif">{formatFCFA(selectedClient.kpis.averageOrderValueXAF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Dernière vente</p>
                      <p className="text-xl font-serif">{selectedClient.kpis.lastOrderDate}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Solde Dû</p>
                      <p className={`text-xl font-serif ${selectedClient.balanceDueXAF > 0 ? 'text-destructive' : 'text-success'}`}>{formatFCFA(selectedClient.balanceDueXAF)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader><CardTitle>Informations Personnelles</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <DataLabel label="Nom" value={selectedClient.identity.lastName} />
                      <DataLabel label="Prénom" value={selectedClient.identity.firstName} />
                      <DataLabel label="Email" value={selectedClient.identity.email} className="col-span-2" />
                      <DataLabel label="Téléphone" value={selectedClient.identity.phone || 'Non renseigné'} />
                      <DataLabel label="Ville" value={selectedClient.identity.city} />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20 flex flex-col">
                    <CardHeader className="bg-primary/5">
                      <CardTitle className="text-primary">Recommandations Imminentes (Top 5)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU Cible</TableHead>
                            <TableHead>Disponibilité</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedClient.recommendations.slice(0, 5).map((rec, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs font-medium text-primary">{rec.sku}</TableCell>
                              <TableCell>{rec.availability}</TableCell>
                              <TableCell className="text-muted-foreground italic text-xs">{rec.source}</TableCell>
                            </TableRow>
                          ))}
                          {selectedClient.recommendations.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Aucune recommandation</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {detailTab === 'adn' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Traits Caractéristiques (Déduits)</CardTitle></CardHeader>
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
            )}

            {detailTab === 'commandes' && (
              <Card>
                <CardHeader><CardTitle>Historique des Commandes</CardTitle></CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Articles</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedClient.orders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.date}</TableCell>
                        <TableCell className="font-mono text-xs">{o.id}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{o.items}</TableCell>
                        <TableCell className="text-right font-medium">{formatFCFA(o.totalXAF)}</TableCell>
                        <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {selectedClient.orders.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Aucune commande</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {detailTab === 'interactions' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Historique des Contacts</CardTitle></CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Résumé</TableHead>
                        <TableHead>Agent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClient.interactions.map((inter, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{inter.date}</TableCell>
                          <TableCell><Badge variant="secondary">{inter.type}</Badge></TableCell>
                          <TableCell className="text-xs">{inter.summary}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{inter.agent}</TableCell>
                        </TableRow>
                      ))}
                      {selectedClient.interactions.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Aucune interaction</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="text-primary">Dicter une communication (Simulation Agent)</CardTitle>
                    <p className="text-xs text-muted-foreground">L'agent IA préparera un message basé sur vos instructions.</p>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Instructions (Texte libre)</label>
                      <textarea className="flex min-h-[120px] w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder={`Ex: Demande-lui s'il a apprécié la dernière boîte de Partagás et propose-lui une réservation sur le nouvel arrivage.`} />
                    </div>
                    <Button className="w-full mt-4" onClick={(e) => { e.preventDefault(); toast({ title: 'Agent Sollicité', description: 'La simulation de préparation du message est en cours (aucun envoi externe).' }); }}>Simuler Préparation IA</Button>
                  </CardContent>
                </Card>
              </div>
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
              Annuaire
            </TabButton>
            <TabButton active={tab === 'creer'} onClick={() => setTab('creer')}>
              Nouveau (Local)
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
                    <TableHead>Prénom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Nb commandes</TableHead>
                    <TableHead className="text-right">CA cumulé</TableHead>
                    <TableHead className="text-right">Solde dû</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map(client => (
                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectClient(client.id)}>
                      <TableCell className="font-mono text-xs text-primary">{client.id}</TableCell>
                      <TableCell className="font-medium">{client.identity.lastName}</TableCell>
                      <TableCell>{client.identity.firstName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{client.identity.phone}</TableCell>
                      <TableCell className="text-xs">{client.identity.city}</TableCell>
                      <TableCell><Badge variant="outline">{client.type}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={client.status === 'Actif' ? 'success' : client.status === 'Blacklisté' ? 'destructive' : 'warning'}>{client.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{client.kpis.totalOrders}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatFCFA(client.kpis.lifetimeValueXAF)}</TableCell>
                      <TableCell className={`text-right font-mono text-xs ${client.balanceDueXAF > 0 ? 'text-destructive' : ''}`}>{formatFCFA(client.balanceDueXAF)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">{client.score}</TableCell>
                    </TableRow>
                  ))}
                  {filteredClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground border-dashed">
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
                <CardTitle className="text-warning">Création (Local uniquement)</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                  <form onSubmit={handleSimulate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Prénom</label>
                        <Input value={formData.firstName} onChange={e => setFormData(prev => ({...prev, firstName: e.target.value}))} placeholder="ex: Jean" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Nom</label>
                        <Input value={formData.lastName} onChange={e => setFormData(prev => ({...prev, lastName: e.target.value}))} placeholder="ex: Dupont" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</label>
                        <Input type="email" value={formData.email} onChange={e => setFormData(prev => ({...prev, email: e.target.value}))} placeholder="ex: jean@example.com" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Téléphone</label>
                        <Input value={formData.phone} onChange={e => setFormData(prev => ({...prev, phone: e.target.value}))} placeholder="ex: +33 6 00..." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Ville</label>
                      <Input value={formData.city} onChange={e => setFormData(prev => ({...prev, city: e.target.value}))} placeholder="ex: Paris" />
                    </div>
                    <Button type="submit" className="w-full mt-4">Enregistrer (Simulé)</Button>
                  </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
