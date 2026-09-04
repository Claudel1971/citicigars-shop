import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, DataLabel, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, FileText } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export default function Fournisseurs() {
  const [tab, setTab] = useState<'consulter' | 'creer'>('consulter');
  const [detailTab, setDetailTab] = useState<'extraction' | 'profil' | 'po'>('extraction');
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);

  // Form mock
  const [supplierName, setSupplierName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam && FIXTURES.suppliers.some(s => s.id === idParam)) {
      setSelectedOppId(idParam);
      setTab('consulter');
    }
  }, []);

  const handleClearSelection = () => {
    setSelectedOppId(null);
    window.history.replaceState({}, '', '/fournisseurs');
  };

  const handleSelectOpp = (id: string) => {
    setSelectedOppId(id);
    setDetailTab('extraction');
    window.history.replaceState({}, '', `/fournisseurs?id=${id}`);
  };

  const selectedOpp = selectedOppId ? FIXTURES.suppliers.find(s => s.id === selectedOppId) : null;

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) return;
    toast({ title: 'Fournisseur Simulé', description: `${supplierName} a été testé localement.` });
    setSupplierName('');
    setTab('consulter');
  };

  if (selectedOpp) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={handleClearSelection} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux opportunités
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif">{selectedOpp.supplierName}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{selectedOpp.id}</Badge>
                <Badge variant={selectedOpp.shadowState === 'EVALUATION' ? 'warning' : 'secondary'}>{selectedOpp.shadowState}</Badge>
              </div>
            </div>
          </div>

          <TabContainer className="mb-6">
            <TabButton active={detailTab === 'extraction'} onClick={() => setDetailTab('extraction')}>Extraction & Preuves</TabButton>
            <TabButton active={detailTab === 'profil'} onClick={() => setDetailTab('profil')}>Profil Canonique</TabButton>
            <TabButton active={detailTab === 'po'} onClick={() => setDetailTab('po')}>Historique & Brouillon PO</TabButton>
          </TabContainer>

          {detailTab === 'extraction' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Informations & Extraction</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <DataLabel label="Source Email" value={selectedOpp.emailSource} />
                    <DataLabel label="Confiance du Modèle" value={`${selectedOpp.confidence}%`} />
                    <DataLabel label="Économie Proposée" value={`${selectedOpp.proposedEconomics.amount} ${selectedOpp.proposedEconomics.currency}`} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Preuves (Attachments)</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {selectedOpp.attachments.map((att, i) => (
                        <li key={i} className="flex items-center justify-between p-3 border border-border bg-muted/20">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{att}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedEvidence(att)}>Consulter</Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              {selectedEvidence && (
                <Card className="mt-6 border-primary/30">
                  <CardHeader><CardTitle>Preuve simulée — lecture seule</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <DataLabel label="Document" value={selectedEvidence} />
                    <DataLabel label="Provenance" value={selectedOpp.emailSource} />
                    <DataLabel label="État" value="Métadonnées disponibles; contenu binaire non chargé en R1" />
                    <Button variant="outline" onClick={() => setSelectedEvidence(null)}>Fermer la preuve</Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {detailTab === 'profil' && (
            <Card className="max-w-2xl">
              <CardHeader><CardTitle>Profil Canonique</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <DataLabel label="Catégorie" value={selectedOpp.canonicalProfile.category} />
                <DataLabel label="Évaluation" value={selectedOpp.canonicalProfile.rating} />
                <DataLabel label="Conditions de Paiement" value={selectedOpp.canonicalProfile.paymentTerms} />
              </CardContent>
            </Card>
          )}

          {detailTab === 'po' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Historique des PO</CardTitle></CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOpp.poHistory.map(po => (
                        <TableRow key={po.poId}>
                          <TableCell className="font-mono text-xs">{po.poId}</TableCell>
                          <TableCell className="text-xs">{po.date}</TableCell>
                          <TableCell className="font-medium">{formatFCFA(po.totalXAF)}</TableCell>
                          <TableCell><Badge variant="outline">{po.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {selectedOpp.poHistory.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Aucun PO dans l'historique</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
                <Card className="border-warning/50">
                  <CardHeader className="bg-warning/10"><CardTitle className="text-warning">Brouillon PO (Simulation)</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-background p-4 border border-border">
                      <div className="flex justify-between items-end mb-4 border-b border-border pb-4">
                        <div>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase">Devise Source</p>
                          <p className="font-mono">{selectedOpp.proposedEconomics.amount} {selectedOpp.proposedEconomics.currency}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-muted-foreground uppercase">Snapshot FX Manuel</p>
                          <p className="font-mono text-primary">655.957 FCFA / EUR</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Estimé (XAF)</span>
                        <span className="text-xl font-serif text-primary">{formatFCFA(selectedOpp.proposedEconomics.amount * 655.957)}</span>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => toast({ title: 'PO Simulé', description: 'Le brouillon a été généré localement. Validation A4 requise.' })}>Générer Brouillon PO</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-serif">Fournisseurs & Opportunités</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Évaluation continue du réseau d'approvisionnement</p>
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Opportunité</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Confiance</TableHead>
                  <TableHead>Matching Inventaire</TableHead>
                  <TableHead>Statut Shadow</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FIXTURES.suppliers.map(opp => (
                  <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectOpp(opp.id)}>
                    <TableCell className="font-mono text-xs">{opp.id}</TableCell>
                    <TableCell className="font-medium">{opp.supplierName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted overflow-hidden">
                          <div className={`h-full ${opp.confidence > 80 ? 'bg-success' : 'bg-warning'}`} style={{width: `${opp.confidence}%`}} />
                        </div>
                        <span className="text-xs font-mono">{opp.confidence}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{opp.matching}%</TableCell>
                    <TableCell><Badge variant="outline">{opp.shadowState}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectOpp(opp.id); }}>Évaluer</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {tab === 'creer' && (
          <div className="max-w-xl">
            <Card>
              <CardHeader className="bg-muted/20">
                <CardTitle>Ajout Manuel (Simulation locale)</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSimulate} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest">Nom du fournisseur</label>
                    <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="ex: Habanos SA" />
                  </div>
                  <Button type="submit" className="w-full">Simuler l'inscription (R1)</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
