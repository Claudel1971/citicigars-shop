import { useState, useEffect, Fragment } from 'react';
import { Link } from 'wouter';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, DataLabel, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Search, FileText } from 'lucide-react';
import { formatFCFA } from '@/lib/utils';

export default function Fournisseurs() {
  const [tab, setTab] = useState<'consulter' | 'creer'>('consulter');
  const [detailTab, setDetailTab] = useState<'infos' | 'historique' | 'po'>('infos');
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  // PO creation local state
  const [fxRate, setFxRate] = useState<string>('');
  const [poAmount, setPoAmount] = useState<string>('');
  const [refDate, setRefDate] = useState<string>('');
  const [poState, setPoState] = useState<'draft' | 'validated' | 'correction'>('draft');
  const [poCurrencySelect, setPoCurrencySelect] = useState<string>('');
  const [poCurrencyCustom, setPoCurrencyCustom] = useState<string>('');

  // Supplier create form
  const [supForm, setSupForm] = useState({ company: '', contact: '', email: '', phone: '', currency: 'EUR' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const tabParam = params.get('detailTab');
    const poParam = params.get('po');
    if (idParam && FIXTURES.suppliers.some(s => s.id === idParam)) {
      setSelectedOppId(idParam);
      setTab('consulter');
      if (tabParam === 'infos' || tabParam === 'historique' || tabParam === 'po') {
        setDetailTab(tabParam as any);
      }
      const opp = FIXTURES.suppliers.find(s => s.id === idParam);
      if (opp) {
        setPoCurrencySelect(opp.originCurrency || 'EUR');
        if (poParam && opp.poHistory.some(po => po.poId === poParam)) {
          setExpandedPoId(poParam);
        }
      }
    }
  }, []);

  const handleClearSelection = () => {
    setSelectedOppId(null);
    window.history.replaceState({}, '', '/fournisseurs');
  };

  const handleSelectOpp = (id: string) => {
    setSelectedOppId(id);
    setDetailTab('infos');
    setExpandedPoId(null);
    setPoState('draft');
    setFxRate('');
    setPoAmount('');
    setRefDate('');
    const opp = FIXTURES.suppliers.find(s => s.id === id);
    if (opp) setPoCurrencySelect(opp.originCurrency || 'EUR');
    setPoCurrencyCustom('');
    window.history.replaceState({}, '', `/fournisseurs?id=${id}&detailTab=infos`);
  };

  const handleDetailTabChange = (t: 'infos' | 'historique' | 'po') => {
    setDetailTab(t);
    if (selectedOppId) {
      window.history.replaceState({}, '', `/fournisseurs?id=${selectedOppId}&detailTab=${t}`);
    }
  };

  const handleTogglePo = (poId: string) => {
    const nextPoId = expandedPoId === poId ? null : poId;
    setExpandedPoId(nextPoId);
    if (selectedOppId) {
      const suffix = nextPoId ? `&po=${encodeURIComponent(nextPoId)}` : '';
      window.history.replaceState({}, '', `/fournisseurs?id=${selectedOppId}&detailTab=historique${suffix}`);
    }
  };

  const actualCurrency = poCurrencySelect === 'Autre' ? poCurrencyCustom : poCurrencySelect;
  const isXAF = actualCurrency.toUpperCase() === 'XAF' || actualCurrency.toUpperCase() === 'FCFA' || actualCurrency.toUpperCase() === 'XAF/FCFA';

  const handleValidatePO = () => {
    if (!poAmount || !refDate || (!isXAF && !fxRate) || (poCurrencySelect === 'Autre' && !poCurrencyCustom)) {
      toast({ title: 'Erreur', description: 'Renseignez le montant, la devise, la date et le taux FX manuel.', variant: 'destructive' });
      return;
    }
    setPoState('validated');
    toast({ title: 'Snapshot Enregistré', description: 'Taux FX et valeur figés. Le PO est validé localement.' });
  };

  const handleCorrectPO = () => {
    setPoState('correction');
    toast({ title: 'Correction tracée', description: "Mode correction activé. L'ancienne valeur sera tracée dans l'historique d'audit." });
  };

  const selectedOpp = selectedOppId ? FIXTURES.suppliers.find(s => s.id === selectedOppId) : null;

  const filteredSuppliers = FIXTURES.suppliers.filter(s => 
    s.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedOpp) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={handleClearSelection} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux fournisseurs
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif">{selectedOpp.supplierName}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{selectedOpp.id}</Badge>
                <Badge variant={selectedOpp.canonicalProfile.category === 'Distributeur Agréé' ? 'success' : 'warning'}>{selectedOpp.canonicalProfile.category}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast({ title: 'Mode édition', description: 'Ouverture du formulaire (Simulation R1).' })}>Modifier</Button>
            </div>
          </div>

          <TabContainer className="mb-6 mt-8">
            <TabButton active={detailTab === 'infos'} onClick={() => handleDetailTabChange('infos')}>Identité & Contact</TabButton>
            <TabButton active={detailTab === 'historique'} onClick={() => handleDetailTabChange('historique')}>Historique des commandes</TabButton>
            <TabButton active={detailTab === 'po'} onClick={() => handleDetailTabChange('po')}>Créer un PO</TabButton>
          </TabContainer>

          {detailTab === 'infos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Contact & Représentant</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <DataLabel label="Contact Principal" value={selectedOpp.contactName} />
                  <DataLabel label="Email de réception des offres" value={selectedOpp.emailSource} />
                  <DataLabel label="Téléphone" value={selectedOpp.phone} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Métriques Fournisseur</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <DataLabel label="Évaluation Risque" value={selectedOpp.canonicalProfile.rating} />
                  <DataLabel label="Conditions de Paiement" value={selectedOpp.canonicalProfile.paymentTerms} />
                  <div className="pt-2 border-t border-border mt-2">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Dépense cumulée XAF</span>
                    <span className="text-2xl font-serif">{formatFCFA(selectedOpp.cumulativeSpendXAF)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({selectedOpp.cumulativeSpendOriginal} {selectedOpp.originCurrency})</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {detailTab === 'historique' && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant Original</TableHead>
                    <TableHead className="text-right">Taux FX (Fixé)</TableHead>
                    <TableHead className="text-right">Total XAF</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOpp.poHistory.map(po => (
                    <Fragment key={po.poId}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/30" 
                        onClick={() => handleTogglePo(po.poId)}
                      >
                        <TableCell className="font-mono text-xs text-primary underline">{po.poId}</TableCell>
                        <TableCell className="text-xs">{po.date}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{po.totalOriginal} {po.currency}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{po.fxRate}</TableCell>
                        <TableCell className="text-right font-medium">{formatFCFA(po.totalXAF)}</TableCell>
                        <TableCell><Badge variant="outline">{po.status}</Badge></TableCell>
                      </TableRow>
                      {expandedPoId === po.poId && (
                        <TableRow className="bg-muted/10 border-b-2 border-primary/20">
                          <TableCell colSpan={6} className="p-4">
                            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Lignes de commande (Items)</h4>
                            <Table className="bg-background border border-border">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>SKU</TableHead>
                                  <TableHead className="text-right">Qté</TableHead>
                                  <TableHead className="text-right">Prix Unit. ({po.currency})</TableHead>
                                  <TableHead className="text-right">Prix Unit. (XAF)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {po.items.map(item => (
                                  <TableRow key={item.sku}>
                                    <TableCell className="font-mono text-xs">
                                      <Link href={`/stock?sku=${item.sku}`} className="text-primary hover:underline">{item.sku}</Link>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-xs">{item.qty}</TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{item.unitPriceOriginal}</TableCell>
                                    <TableCell className="text-right font-mono text-xs">{formatFCFA(item.unitPriceXAF)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                  {selectedOpp.poHistory.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Aucun PO dans l'historique</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          {detailTab === 'po' && (
            <Card className="max-w-2xl border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-primary">Enregistrement PO Manuel (Simulation)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Le taux FX de la transaction doit être figé manuellement par l'opérateur pour tracer la valeur d'immobilisation XAF exacte au moment du paiement.</p>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Montant</label>
                    <Input type="number" value={poAmount} onChange={e => setPoAmount(e.target.value)} placeholder="0.00" disabled={poState === 'validated'} />
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Devise</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" value={poCurrencySelect} onChange={e => setPoCurrencySelect(e.target.value)} disabled={poState === 'validated'}>
                      <option value="XAF">XAF / FCFA</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="Autre">Autre...</option>
                    </select>
                    {poCurrencySelect === 'Autre' && (
                      <Input className="mt-2" value={poCurrencyCustom} onChange={e => setPoCurrencyCustom(e.target.value)} placeholder="Code devise (ex: CHF)" disabled={poState === 'validated'} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Date</label>
                    <Input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} disabled={poState === 'validated'} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {isXAF ? "Taux de change (Fixé à 1:1 pour XAF/FCFA)" : `Taux de change Manuel (XAF pour 1 ${actualCurrency || '?'})`}
                  </label>
                  <Input type="number" value={isXAF ? '1' : fxRate} onChange={e => { if(!isXAF) setFxRate(e.target.value) }} step="0.001" disabled={poState === 'validated' || isXAF} placeholder="Ex: 655.957" />
                </div>
                
                <div className="bg-muted/30 border border-border p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Équivalent Fixé (Immuable) :</span>
                    <span className="text-xl font-serif text-primary">
                      {formatFCFA((parseFloat(poAmount || '0') * parseFloat((isXAF ? '1' : fxRate) || '0')) || 0)}
                    </span>
                  </div>
                </div>

                {poState === 'validated' && (
                  <div className="bg-primary/10 border-l-4 border-primary p-3 flex items-center gap-2 text-sm text-primary">
                    <FileText className="w-4 h-4" /> <strong>Snapshot Figé.</strong> Ce PO est enregistré en historique.
                  </div>
                )}
                
                {poState !== 'validated' ? (
                  <Button className="w-full mt-4" onClick={handleValidatePO}>Valider et Figer le Snapshot</Button>
                ) : (
                  <Button className="w-full mt-4 border-warning text-warning hover:bg-warning hover:text-warning-foreground" variant="outline" onClick={handleCorrectPO}>Corriger (Créer une trace historique)</Button>
                )}
              </CardContent>
            </Card>
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
            <h1 className="text-3xl font-serif">Fournisseurs & Réseau</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Gestion des relations d'approvisionnement</p>
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
                placeholder="Rechercher par nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Devise</TableHead>
                    <TableHead className="text-right">Dépense (Origine)</TableHead>
                    <TableHead className="text-right">Dépense (XAF)</TableHead>
                    <TableHead>Catégorie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map(opp => (
                    <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectOpp(opp.id)}>
                      <TableCell className="font-medium text-primary">{opp.supplierName}</TableCell>
                      <TableCell className="text-xs">{opp.contactName}</TableCell>
                      <TableCell className="text-xs">{opp.emailSource}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{opp.phone}</TableCell>
                      <TableCell className="font-mono text-xs">{opp.originCurrency}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{opp.cumulativeSpendOriginal}</TableCell>
                      <TableCell className="text-right font-medium text-xs">{formatFCFA(opp.cumulativeSpendXAF)}</TableCell>
                      <TableCell><Badge variant="outline">{opp.canonicalProfile.category}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground border-dashed">Aucun fournisseur trouvé.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {tab === 'creer' && (
          <div className="max-w-xl">
            <Card>
              <CardHeader className="bg-muted/20">
                <CardTitle>Ajout Manuel (Simulation locale)</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={(e) => { 
                  e.preventDefault(); 
                  toast({ title: "Simulation locale", description: "Fournisseur non créé en base R1." });
                  setSupForm({ company: '', contact: '', email: '', phone: '', currency: 'EUR' });
                }} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Entreprise</label>
                    <Input placeholder="ex: Habanos SA" value={supForm.company} onChange={e => setSupForm(prev => ({...prev, company: e.target.value}))} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Contact / Manager</label>
                    <Input placeholder="ex: Carlos M." value={supForm.contact} onChange={e => setSupForm(prev => ({...prev, contact: e.target.value}))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Email</label>
                      <Input type="email" placeholder="contact@..." value={supForm.email} onChange={e => setSupForm(prev => ({...prev, email: e.target.value}))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Téléphone</label>
                      <Input placeholder="+..." value={supForm.phone} onChange={e => setSupForm(prev => ({...prev, phone: e.target.value}))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Devise d'origine</label>
                    <select className="h-10 w-full border border-border bg-card px-3 text-sm focus:outline-none focus:border-primary" value={supForm.currency} onChange={e => setSupForm(prev => ({...prev, currency: e.target.value}))}>
                      <option>EUR</option>
                      <option>USD</option>
                      <option>CHF</option>
                      <option>GBP</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full mt-4">Simuler l'inscription (R1)</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
