import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, DataLabel, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Activity, ArrowLeft, Search, Filter, Plane, Target, ShieldCheck, MapPin, Handshake, CheckCircle2 } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export default function Vendre() {
  const [tab, setTab] = useState<'pipeline' | 'kpis'>('pipeline');
  const [detailTab, setDetailTab] = useState<'synthese' | 'attribution' | 'handoff' | 'adn'>('synthese');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const tabParam = params.get('tab');
    const detailTabParam = params.get('detailTab');
    if (tabParam === 'kpis') {
      setTab('kpis');
    }
    if (idParam && FIXTURES.leads.some(l => l.id === idParam)) {
      setSelectedLeadId(idParam);
      setTab('pipeline');
      if (detailTabParam === 'synthese' || detailTabParam === 'attribution' || detailTabParam === 'handoff' || detailTabParam === 'adn') {
        setDetailTab(detailTabParam);
      }
    }
  }, []);

  const handleClearSelection = () => {
    setSelectedLeadId(null);
    window.history.replaceState({}, '', '/vendre');
  };

  const handleSelectLead = (id: string) => {
    setSelectedLeadId(id);
    setDetailTab('synthese');
    window.history.replaceState({}, '', `/vendre?id=${id}`);
  };

  const selectedLead = selectedLeadId ? FIXTURES.leads.find(l => l.id === selectedLeadId) : null;
  const client = selectedLead?.clientId ? FIXTURES.clients.find(c => c.id === selectedLead?.clientId) : null;

  const filteredLeads = FIXTURES.leads.filter(l => 
    (filterStage === 'all' || l.pipelineStage === filterStage) &&
    (l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const completedSales = FIXTURES.leads.filter(
    lead => lead.pipelineStage === 'paid' || lead.pipelineStage === 'fulfilled'
  );
  const acquisitionIndependent = completedSales.filter(
    lead =>
      lead.attribution.attributionStatus === 'attributed' &&
      lead.attribution.relationshipDistance !== 'unknown' &&
      lead.attribution.relationshipDistance !== '0'
  );
  const executionIndependentStrict = completedSales.filter(
    lead => lead.attribution.claudelIntervention === 'none'
  );
  const executionIndependentBroad = completedSales.filter(
    lead =>
      lead.attribution.claudelIntervention === 'none' ||
      lead.attribution.claudelIntervention === 'light'
  );

  if (selectedLead) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={handleClearSelection} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour au Pipeline
          </button>
          
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-serif">{selectedLead.title}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <Badge variant="outline">{selectedLead.id}</Badge>
                <Badge variant={
                  selectedLead.pipelineStage === 'won_pending_payment' || selectedLead.pipelineStage === 'paid' || selectedLead.pipelineStage === 'fulfilled' ? 'success' : 
                  selectedLead.pipelineStage === 'lost' || selectedLead.pipelineStage === 'non_qualified' ? 'destructive' : 'warning'
                }>
                  {selectedLead.pipelineStage.toUpperCase().replace(/_/g, ' ')}
                </Badge>
                {selectedLead.accountId && (
                  <Badge variant="secondary">Compte: {FIXTURES.accounts.find(a => a.id === selectedLead.accountId)?.name || selectedLead.accountId}</Badge>
                )}
                {client && (
                  <Link href={`/clients?id=${client.id}`} className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                    <Target className="w-3 h-3" /> Client: {client.identity.firstName} {client.identity.lastName}
                  </Link>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 min-w-[250px] p-3 border border-warning/50 bg-warning/5">
              <p className="text-[10px] uppercase font-mono text-warning-foreground tracking-widest font-bold border-b border-warning/20 pb-1 mb-1">
                Critère de sortie (Action Actuelle)
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground font-medium">{selectedLead.nextAction.type}</span>
                <span className="text-[10px] font-mono bg-warning text-warning-foreground px-1 py-0.5">{new Date(selectedLead.nextAction.dueAt).toLocaleDateString()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{selectedLead.nextAction.description}</p>
              <div className="flex justify-between items-center mt-1 border-t border-warning/10 pt-1">
                <span className="text-[9px] uppercase font-mono text-muted-foreground">Responsable</span>
                <span className="text-xs font-medium">{FIXTURES.employees.find(e => e.id === selectedLead.nextAction.ownerId)?.firstName || selectedLead.nextAction.ownerId}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <TabContainer className="mb-6">
              <TabButton active={detailTab === 'synthese'} onClick={() => setDetailTab('synthese')}>Synthèse</TabButton>
              <TabButton active={detailTab === 'attribution'} onClick={() => setDetailTab('attribution')}>Attribution / Consentement</TabButton>
              <TabButton active={detailTab === 'handoff'} onClick={() => setDetailTab('handoff')}>Handoff MTL → DLA</TabButton>
              <TabButton active={detailTab === 'adn'} onClick={() => setDetailTab('adn')}>Historique / DNA</TabButton>
            </TabContainer>

            {detailTab === 'synthese' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Revenu Attendu</p>
                      <p className="text-xl font-serif text-foreground">{formatFCFA(selectedLead.financials.expectedRevenueXAF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Marge Attendue</p>
                      <p className="text-xl font-serif text-success">{formatFCFA(selectedLead.financials.expectedMarginXAF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Owner Actuel</p>
                      <p className="text-sm font-medium mt-2">{FIXTURES.employees.find(e => e.id === selectedLead.owners.current)?.firstName || selectedLead.owners.current}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Dernier Contact</p>
                      <p className="text-sm font-medium mt-2">{selectedLead.lastContactAt ? new Date(selectedLead.lastContactAt).toLocaleString() : 'Jamais'}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader><CardTitle>Informations Clés</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <DataLabel label="Source initiale" value={selectedLead.attribution.initialSource} />
                      <DataLabel label="Délai de première réponse" value={selectedLead.firstResponseDelayMinutes ? `${selectedLead.firstResponseDelayMinutes} min` : 'N/A'} />
                      <DataLabel label="Intérêts Produit" value={selectedLead.productInterests.length ? selectedLead.productInterests.join(', ') : 'Non défini'} className="col-span-2" />
                      <DataLabel label="Intérêts Usage" value={selectedLead.usageInterests.length ? selectedLead.usageInterests.join(', ') : 'Non défini'} className="col-span-2" />
                      <div className="col-span-2 mt-4 space-y-2">
                        <Button className="w-full" onClick={() => toast({ title: 'Simulation', description: 'Passage à l\'étape suivante validé manuellement.' })}>Avancer l'opportunité (Simulation)</Button>
                        <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => toast({ title: 'Clôture', description: 'Opportunité marquée comme Perdue / Non-Qualifiée.' })}>Fermer l'opportunité (Non-qualifiée)</Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="bg-primary/5">
                      <CardTitle className="text-primary">Gouvernance des Owners</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <DataLabel label="Conversation" value={FIXTURES.employees.find(e => e.id === selectedLead.owners.conversation)?.lastName || selectedLead.owners.conversation} />
                      <DataLabel label="Décision Commerciale" value={FIXTURES.employees.find(e => e.id === selectedLead.owners.commercialDecision)?.lastName || selectedLead.owners.commercialDecision} />
                      <DataLabel label="Exécution Physique" value={
                        selectedLead.owners.physicalExecution === 'N/A' 
                        ? <span className="text-muted-foreground italic">Non assigné</span> 
                        : (FIXTURES.employees.find(e => e.id === selectedLead.owners.physicalExecution)?.lastName || selectedLead.owners.physicalExecution)
                      } />
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {detailTab === 'attribution' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Attribution de l'opportunité</CardTitle>
                      <Badge variant={selectedLead.attribution.attributionStatus === 'attributed' ? 'success' : selectedLead.attribution.attributionStatus === 'unattributed' ? 'destructive' : 'warning'}>
                        {selectedLead.attribution.attributionStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedLead.attribution.unattributedReason && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                        <span className="font-bold">Raison (Non-Attribué):</span> {selectedLead.attribution.unattributedReason}
                      </div>
                    )}
                    <DataLabel label="Point de contact initial" value={selectedLead.attribution.initialSource} />
                    <DataLabel label="Création du Lead (Trigger)" value={selectedLead.attribution.leadCreationSource} />
                    <DataLabel label="Canal de Conversion" value={selectedLead.attribution.conversionSource} />
                    <DataLabel label="Campagne" value={selectedLead.attribution.campaignId} />
                    <DataLabel label="Touchpoint" value={selectedLead.attribution.touchpointId} />
                    
                    <div className="pt-4 border-t border-border">
                      <DataLabel label="Indice de Confiance" value={`${selectedLead.attribution.confidence}%`} />
                      <div className="mt-2 space-y-2">
                        <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest">Preuves d'attribution</p>
                        {selectedLead.attribution.evidence.length > 0 ? selectedLead.attribution.evidence.map(ev => (
                          <div key={ev.id} className="text-xs bg-muted/30 p-2 border border-border/50">
                            <span className="font-mono text-[10px] text-primary">{ev.type}</span>: {ev.proof} (Confiance: {ev.confidence}%)
                          </div>
                        )) : <span className="text-xs text-muted-foreground">Aucune preuve</span>}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-2">Métriques d'Influence</p>
                      <div className="grid grid-cols-2 gap-2">
                        <DataLabel label="Distance de Relation" value={`Niveau ${selectedLead.attribution.relationshipDistance}`} />
                        <DataLabel label="Intervention Claudel" value={selectedLead.attribution.claudelIntervention} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Statut du Consentement</CardTitle>
                      <Badge variant={selectedLead.consent.status === 'granted' ? 'success' : 'destructive'}>{selectedLead.consent.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-5 h-5 ${selectedLead.consent.adultVerified ? 'text-success' : 'text-warning'}`} />
                      <span className="text-sm font-medium">{selectedLead.consent.adultVerified ? 'Majorité vérifiée' : 'Majorité NON vérifiée'}</span>
                    </div>
                    <DataLabel label="Version des conditions" value={selectedLead.consent.version} mono />
                    <DataLabel label="Texte approuvé" value={selectedLead.consent.textVersion} className="italic text-xs text-muted-foreground" />
                    
                    <div className="mt-2">
                      <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Canaux Autorisés</p>
                      <div className="flex gap-2 mb-2">
                        {selectedLead.consent.channels.length > 0 ? selectedLead.consent.channels.map(cp => (
                          <Badge key={cp} variant="outline">{cp}</Badge>
                        )) : <span className="text-xs text-muted-foreground">Aucun canal défini</span>}
                      </div>
                      <p className="text-[10px] text-warning/80 flex items-center gap-1">
                        <span className="font-bold">Info:</span> Un clic WhatsApp initié par le client ne constitue pas un consentement permanent global.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border grid grid-cols-2 gap-2">
                      <DataLabel label="Finalité" value={selectedLead.consent.purpose} />
                      <DataLabel label="Date" value={new Date(selectedLead.consent.capturedAt).toLocaleString()} />
                      <DataLabel label="Source" value={selectedLead.consent.source} />
                      <DataLabel label="Preuve" value={selectedLead.consent.proof} mono />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {detailTab === 'handoff' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
                  <Plane className="w-4 h-4" /> 
                  <span>Transfert de responsabilité commerciale et logistique</span>
                </div>

                {selectedLead.handoffs.length === 0 ? (
                  <Card className="border-dashed bg-transparent shadow-none">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                      <Handshake className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-sm">Aucun transfert documenté (Handoff) sur ce lead.</p>
                      <Button variant="outline" className="mt-4" onClick={() => toast({ title: 'Simulation Handoff', description: 'Ouverture du formulaire de transfert (Simulation).' })}>Initier un Handoff vers Douala</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {selectedLead.handoffs.map(ho => (
                      <Card key={ho.id} className="border-l-4 border-l-primary relative overflow-hidden">
                        {ho.acceptedAt && (
                          <div className="absolute top-4 right-4 text-success flex flex-col items-end">
                            <div className="flex items-center gap-1 text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4" /> Accepté
                            </div>
                            <span className="text-[10px] font-mono mt-1">{new Date(ho.acceptedAt).toLocaleString()}</span>
                          </div>
                        )}
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{ho.id}</span>
                            <span>Handoff: {FIXTURES.employees.find(e => e.id === ho.from)?.lastName} → {FIXTURES.employees.find(e => e.id === ho.to)?.lastName}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <DataLabel label="Owner Campagne Entrant" value={FIXTURES.employees.find(e => e.id === ho.incomingOwnerId)?.lastName || ho.incomingOwnerId} className="text-primary" />
                            <DataLabel label="Contexte de vente" value={ho.context} />
                            <DataLabel label="Promesse Client" value={ho.promise} className="text-primary font-medium" />
                            <DataLabel label="Canal de consentement actif" value={ho.consentChannel} />
                          </div>
                          <div className="space-y-3">
                            <DataLabel label="Étape du transfert" value={ho.step} />
                            <DataLabel label="Décision attendue du repreneur" value={ho.expectedDecision} />
                            <DataLabel label="Échéance (SLA)" value={new Date(ho.deadline).toLocaleString()} />
                            <DataLabel label="Preuve d'accord" value={ho.acceptanceProof ? `${ho.acceptanceProof.type} - ${ho.acceptanceProof.evidence}` : (ho.evidence || 'N/A')} mono />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'adn' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Historique du Pipeline</CardTitle></CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horodatage</TableHead>
                        <TableHead>Étape (Stage)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLead.stageHistory.map((sh, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{new Date(sh.changedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sh.stage}</Badge>
                            <span className="block text-[10px] text-muted-foreground mt-1">{sh.reason} · {sh.changedBy}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {(selectedLead.dnaBlock2Selections.length > 0 || selectedLead.dnaBlock3FreeChoices.length > 0) && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Bloc 2 · Propositions retenues (Contexte Lead)</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Saisie lors de la qualification.</p>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>SKU / Produit</TableHead>
                              <TableHead>Classe</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedLead.dnaBlock2Selections.slice(0, 5).map(choice => (
                              <TableRow key={choice.id}>
                                <TableCell>
                                  <Link href={`/stock?sku=${choice.sku}`} className="font-mono text-[10px] text-primary block hover:underline">{choice.sku}</Link>
                                  <span className="text-sm font-medium">{choice.name}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={choice.classification === 'A1' ? 'success' : 'outline'}>{choice.classification}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Bloc 3 · Demandes libres (Contexte Lead)</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Cigares souhaités hors de la proposition.</p>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produit demandé</TableHead>
                              <TableHead>Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedLead.dnaBlock3FreeChoices.slice(0, 5).map(choice => (
                              <TableRow key={choice.id}>
                                <TableCell>
                                  {choice.sku ? <Link href={`/stock?sku=${choice.sku}`} className="font-mono text-[10px] text-primary block hover:underline">{choice.sku}</Link> : null}
                                  <span className="text-sm font-medium">{choice.name}</span>
                                  <span className="text-[10px] text-muted-foreground block mt-0.5">{choice.context}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{choice.catalogStatus}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {(selectedLead.dnaBlock2Selections.length > 0 || selectedLead.dnaBlock3FreeChoices.length > 0) && (
                  <Card className="border-primary/20">
                    <CardHeader className="bg-primary/5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle>Vue consolidée DNA (Max 10)</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">Agrégation des Blocs 2 et 3 sans mutation des stocks centraux.</p>
                        </div>
                        <Badge variant="secondary">
                          {Math.min(selectedLead.dnaBlock2Selections.length + selectedLead.dnaBlock3FreeChoices.length, 10)} / 10
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Origine</TableHead>
                            <TableHead>Produit</TableHead>
                            <TableHead>Raison / Contexte</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...selectedLead.dnaBlock2Selections.map(s => ({ ...s, origin: 'Bloc 2' })), ...selectedLead.dnaBlock3FreeChoices.map(s => ({ ...s, origin: 'Bloc 3' }))].slice(0, 10).map((choice, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-medium">{choice.origin}</TableCell>
                              <TableCell>
                                {choice.sku && <span className="font-mono text-[10px] text-primary block">{choice.sku}</span>}
                                <span className="text-sm font-medium">{choice.name}</span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{choice.context}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
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
            <h1 className="text-3xl font-serif">Vendre</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Pipeline Commercial & Handoff</p>
          </div>
          <TabContainer>
            <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')}>
              Pipeline Actif
            </TabButton>
            <TabButton active={tab === 'kpis'} onClick={() => setTab('kpis')}>
              KPIs Acquisition & Indépendance
            </TabButton>
          </TabContainer>
        </header>

        {tab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  placeholder="Rechercher Lead ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select 
                  className="h-10 border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary"
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                >
                  <option value="all">Toutes les étapes</option>
                  <option value="contact_pending">À Contacter</option>
                  <option value="offer_or_dna">Proposition / DNA</option>
                  <option value="won_pending_payment">Gagné (Attente Paiement)</option>
                </select>
              </div>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Opportunité</TableHead>
                    <TableHead>Étape Pipeline</TableHead>
                    <TableHead>Prochaine Action</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Revenu Est.</TableHead>
                    <TableHead className="text-center">Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map(lead => {
                    const isMissingNextAction = !lead.nextAction || !lead.nextAction.dueAt || !lead.nextAction.ownerId;
                    return (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectLead(lead.id)}>
                      <TableCell className="font-mono text-xs text-primary">{lead.id}</TableCell>
                      <TableCell className="font-medium">
                        {lead.title}
                        {lead.clientId && <span className="block text-[10px] text-muted-foreground mt-0.5">Client existant: {lead.clientId}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          lead.pipelineStage === 'won_pending_payment' || lead.pipelineStage === 'paid' || lead.pipelineStage === 'fulfilled' ? 'success' : 
                          lead.pipelineStage === 'contact_pending' ? 'warning' : 'outline'
                        }>
                          {lead.pipelineStage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{lead.nextAction.type}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{new Date(lead.nextAction.dueAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{FIXTURES.employees.find(e => e.id === lead.owners.current)?.lastName || lead.owners.current}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatFCFA(lead.financials.expectedRevenueXAF)}</TableCell>
                      <TableCell className="text-center">
                        {isMissingNextAction ? (
                          <Badge variant="destructive" title="Action suivante ou propriétaire manquant">Incomplet</Badge>
                        ) : (
                          <Badge variant="success" className="bg-success/20 text-success border-success/30">Valide</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )})}
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground border-dashed">
                        Aucun lead trouvé pour ces critères.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {tab === 'kpis' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-muted/20 border border-border text-sm">
              <Activity className="w-4 h-4 text-primary" /> 
              <span>KPIs calculés strictement. L'Acquisition exclut l'origine 'unknown' et la distance '0' (demande indépendante prouvée). L'Exécution exige un Claudel 'none' ou 'light'.</span>
            </div>

            <h2 className="text-xl font-serif mt-8 mb-2">Indépendance d'acquisition prouvée</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Ventes Indépendantes (Volume)</p>
                  <p className="text-2xl font-serif text-foreground">
                    {acquisitionIndependent.length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Revenu (Acquisition)</p>
                  <p className="text-2xl font-serif text-primary">
                    {formatFCFA(acquisitionIndependent.reduce((sum, lead) => sum + (lead.financials.actualRevenueXAF ?? 0), 0))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Marge (Acquisition)</p>
                  <p className="text-2xl font-serif text-success">
                    {formatFCFA(acquisitionIndependent.reduce((sum, lead) => sum + (lead.financials.actualMarginXAF ?? 0), 0))}
                  </p>
                </CardContent>
              </Card>
            </div>

            <h2 className="text-xl font-serif mt-8 mb-2">Indépendance d'exécution — Claudel none</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Ventes payées (Nombre)</p>
                  <p className="text-2xl font-serif text-foreground">{executionIndependentStrict.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">CA payé</p>
                  <p className="text-2xl font-serif text-primary">
                    {formatFCFA(executionIndependentStrict.reduce((sum, lead) => sum + (lead.financials.actualRevenueXAF ?? 0), 0))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Marge réalisée</p>
                  <p className="text-2xl font-serif text-success">
                    {formatFCFA(executionIndependentStrict.reduce((sum, lead) => sum + (lead.financials.actualMarginXAF ?? 0), 0))}
                  </p>
                </CardContent>
              </Card>
            </div>

            <h2 className="text-xl font-serif mt-8 mb-2">Indépendance d'exécution — Claudel none + light</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="p-4">
                <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Ventes payées (Nombre)</p>
                <p className="text-2xl font-serif text-foreground">{executionIndependentBroad.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">CA payé</p>
                <p className="text-2xl font-serif text-primary">{formatFCFA(executionIndependentBroad.reduce((sum, lead) => sum + (lead.financials.actualRevenueXAF ?? 0), 0))}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest mb-1">Marge réalisée</p>
                <p className="text-2xl font-serif text-success">{formatFCFA(executionIndependentBroad.reduce((sum, lead) => sum + (lead.financials.actualMarginXAF ?? 0), 0))}</p>
              </CardContent></Card>
            </div>

            <Card className="mt-8">
              <CardHeader><CardTitle>Performance des Campagnes / Expériences</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campagne</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Owners (Conv/Dec/Phys)</TableHead>
                    <TableHead>Expériences</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FIXTURES.campaigns.map(camp => {
                    const exps = FIXTURES.experiments.filter(e => e.campaignId === camp.id);
                    return (
                    <TableRow key={camp.id}>
                      <TableCell className="font-medium">{camp.name}</TableCell>
                      <TableCell><Badge variant="secondary">{camp.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {FIXTURES.employees.find(e => e.id === camp.owners.conversation)?.lastName || camp.owners.conversation} / {FIXTURES.employees.find(e => e.id === camp.owners.commercialDecision)?.lastName || camp.owners.commercialDecision} / {FIXTURES.employees.find(e => e.id === camp.owners.physicalExecution)?.lastName || camp.owners.physicalExecution}
                      </TableCell>
                      <TableCell className="text-xs">
                        {exps.length > 0 ? exps.map(e => <span key={e.id} className="block">{e.name} ({e.variant})</span>) : 'Aucune'}
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
