import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, DataLabel, TabContainer, TabButton } from '@/components/ui/bespoke';
import { FIXTURES } from '@/lib/fixtures';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFCFA } from '@/lib/utils';

export default function Stock() {
  const [filter, setFilter] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [drillTab, setDrillTab] = useState<'lots'|'valeur'|'record'>('lots');
  const [perspective, setPerspective] = useState<'tout' | 'disponibilite' | 'engage' | 'valeur' | 'rotation'>('tout');
  const [locationFilter, setLocationFilter] = useState('Tous');
  const [levelFilter, setLevelFilter] = useState('Tous');
  const [provenanceFilter, setProvenanceFilter] = useState('Toutes');
  const [packFilter, setPackFilter] = useState('Tous');
  const [lotFilter, setLotFilter] = useState('Tous');

  const locations = ['Tous', ...Array.from(new Set(FIXTURES.stock.map((item) => item.location)))];
  const provenances = ['Toutes', ...Array.from(new Set(FIXTURES.stock.map((item) => item.provenance)))];
  const packSizes = ['Tous', ...Array.from(new Set(FIXTURES.stock.map((item) => String(item.packSize))))];
  const lotFilterOptions = ['Tous', ...Array.from(new Set(FIXTURES.stock.flatMap(s => s.lotDetails.map(l => l.lot))))];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const skuParam = params.get('sku');
    if (skuParam && FIXTURES.stock.some(s => s.sku === skuParam)) {
      setSelectedSku(skuParam);
    }
  }, []);

  const handleClearSelection = () => {
    setSelectedSku(null);
    window.history.replaceState({}, '', '/stock');
  };

  const handleSelectSku = (sku: string) => {
    setSelectedSku(sku);
    setDrillTab('lots');
    window.history.replaceState({}, '', `/stock?sku=${sku}`);
  };

  const filteredStock = FIXTURES.stock.filter(s => 
    (
      s.sku.toLowerCase().includes(filter.toLowerCase()) || 
      s.type.toLowerCase().includes(filter.toLowerCase()) ||
      s.brand.toLowerCase().includes(filter.toLowerCase()) ||
      s.location.toLowerCase().includes(filter.toLowerCase()) ||
      s.lot.toLowerCase().includes(filter.toLowerCase()) ||
      s.provenance.toLowerCase().includes(filter.toLowerCase()) ||
      String(s.packSize).includes(filter)
    ) &&
    (locationFilter === 'Tous' || s.location === locationFilter) &&
    (provenanceFilter === 'Toutes' || s.provenance === provenanceFilter) &&
    (packFilter === 'Tous' || String(s.packSize) === packFilter) &&
    (lotFilter === 'Tous' || s.lotDetails.some(l => l.lot === lotFilter)) &&
    (
      levelFilter === 'Tous' ||
      (levelFilter === 'Rupture' && s.aggregate === 0) ||
      (levelFilter === 'Bas' && s.aggregate > 0 && s.aggregate <= 50) ||
      (levelFilter === 'Sain' && s.aggregate > 50)
    ) &&
    (
      perspective === 'tout' ||
      (perspective === 'disponibilite' && s.aggregate - s.reserved - s.allocated > 0) ||
      (perspective === 'engage' && (s.reserved > 0 || s.allocated > 0)) ||
      (perspective === 'valeur' && s.immobilizedValueXAF >= 500000) ||
      (perspective === 'rotation' && s.rotationCategory === 'Lente')
    )
  );

  const selectedItem = selectedSku ? FIXTURES.stock.find(s => s.sku === selectedSku) : null;

  if (selectedItem) {
    return (
      <Layout>
        <div className="space-y-6">
          <button onClick={handleClearSelection} className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour à l'inventaire
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">{selectedItem.brand}</div>
              <h1 className="text-3xl font-serif">{selectedItem.type}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="text-sm px-2 py-1">{selectedItem.sku}</Badge>
                {selectedItem.aggregate > 0 ? (
                  <Badge variant="success">En Stock</Badge>
                ) : (
                  <Badge variant="destructive">Rupture</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Volume Agrégé</span>
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div className="text-4xl font-serif">{selectedItem.aggregate}</div>
                <p className="text-xs text-muted-foreground mt-2">Total unités physiques</p>
                <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">RÉSERVÉ</div>
                    <div className="text-sm font-bold text-warning">{selectedItem.reserved}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">ALLOUÉ</div>
                    <div className="text-sm font-bold text-primary">{selectedItem.allocated}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">DISPO NET</div>
                    <div className="text-sm font-bold text-success">{selectedItem.aggregate - selectedItem.reserved - selectedItem.allocated}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Localisation Principale</span>
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="text-xl font-serif">{selectedItem.location}</div>
                <p className="text-xs text-muted-foreground mt-2">Provenance: {selectedItem.provenance}</p>
                <div className="mt-4 pt-4 border-t border-border text-xs">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Conditionnement</span>
                  Boîtes de {selectedItem.packSize}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Santé & Fraîcheur</span>
                </div>
                <div className="text-xl font-serif">{selectedItem.freshness}</div>
                <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">ÂGE</div>
                    <div className="text-sm font-bold">{selectedItem.age}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground">ROTATION</div>
                    <div className="text-sm font-bold">{selectedItem.rotationCategory}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <TabContainer className="mb-6 mt-6">
            <TabButton active={drillTab === 'lots'} onClick={() => setDrillTab('lots')}>Lots & Emplacements</TabButton>
            <TabButton active={drillTab === 'valeur'} onClick={() => setDrillTab('valeur')}>Valeur & Capital</TabButton>
            <TabButton active={drillTab === 'record'} onClick={() => setDrillTab('record')}>Enregistrement</TabButton>
          </TabContainer>

          {drillTab === 'lots' && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead>Emplacement Physique</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItem.lotDetails.length > 0 ? (
                    selectedItem.lotDetails.map(l => (
                      <TableRow key={l.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDrillTab('record')}>
                        <TableCell className="font-mono text-xs">{l.lot}</TableCell>
                        <TableCell>{l.location}</TableCell>
                        <TableCell className="text-right font-bold">{l.quantity}</TableCell>
                        <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun lot physique disponible</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          {drillTab === 'valeur' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Évaluation</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <DataLabel label="Valeur Unitaire Estimée" value={formatFCFA(selectedItem.unitValueXAF)} />
                  <DataLabel label="Capital Immobilisé" value={formatFCFA(selectedItem.immobilizedValueXAF)} className="text-xl" />
                </CardContent>
              </Card>
            </div>
          )}

          {drillTab === 'record' && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle>Enregistrement stock simulé</CardTitle>
                <p className="text-xs font-mono text-muted-foreground">
                  Agrégat / {selectedItem.brand} / {selectedItem.sku} / {selectedItem.lot} / {selectedItem.location}
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <DataLabel label="ID enregistrement" value={`REC-${selectedItem.sku}-${selectedItem.lot}`} />
                <DataLabel label="SKU canonique" value={selectedItem.sku} />
                <DataLabel label="Lot Principal" value={selectedItem.lot} />
                <DataLabel label="Emplacement Principal" value={selectedItem.location} />
                <DataLabel label="Provenance" value={selectedItem.provenance} />
                <DataLabel label="Conditionnement" value={`Boîte de ${selectedItem.packSize}`} />
                <DataLabel label="Disponible" value={String(selectedItem.aggregate - selectedItem.reserved - selectedItem.allocated)} />
                <DataLabel label="Réservé / alloué" value={`${selectedItem.reserved} / ${selectedItem.allocated}`} />
                <DataLabel label="Dernière projection" value={selectedItem.freshness} />
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
        <header className="flex flex-col gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-serif">Stock Central</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-2">Vue consolidée des inventaires et flux</p>
          </div>
          <div className="w-full md:w-96 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Filtrer (SKU, Marque, Produit, Emplacement)..." 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </header>

        <TabContainer className="mb-6">
          {([
            ['tout', 'Tous les stocks'],
            ['disponibilite', 'Disponible'],
            ['engage', 'Réservé / alloué'],
            ['valeur', 'Capital immobilisé'],
            ['rotation', 'Rotation lente'],
          ] as const).map(([value, label]) => (
            <TabButton
              key={value}
              active={perspective === value}
              onClick={() => setPerspective(value)}
            >
              {label}
            </TabButton>
          ))}
        </TabContainer>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Emplacement
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="mt-2 h-10 w-full border border-border bg-card px-3 text-sm text-foreground"
            >
              {locations.map((location) => <option key={location}>{location}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Lot
            <select
              value={lotFilter}
              onChange={(event) => setLotFilter(event.target.value)}
              className="mt-2 h-10 w-full border border-border bg-card px-3 text-sm text-foreground"
            >
              {lotFilterOptions.map((lot) => <option key={lot}>{lot}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Provenance
            <select
              value={provenanceFilter}
              onChange={(event) => setProvenanceFilter(event.target.value)}
              className="mt-2 h-10 w-full border border-border bg-card px-3 text-sm text-foreground"
            >
              {provenances.map((provenance) => <option key={provenance}>{provenance}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Conditionnement
            <select
              value={packFilter}
              onChange={(event) => setPackFilter(event.target.value)}
              className="mt-2 h-10 w-full border border-border bg-card px-3 text-sm text-foreground"
            >
              {packSizes.map((pack) => <option key={pack} value={pack}>{pack === 'Tous' ? pack : `Boîte de ${pack}`}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Niveau
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="mt-2 h-10 w-full border border-border bg-card px-3 text-sm text-foreground"
            >
              {['Tous', 'Sain', 'Bas', 'Rupture'].map((level) => <option key={level}>{level}</option>)}
            </select>
          </label>
          <div className="border border-border bg-card px-4 py-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Résultats</span>
            <p className="text-2xl font-serif">{filteredStock.length}</p>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Marque / Produit</TableHead>
                <TableHead>Emplacement</TableHead>
                <TableHead className="text-right">Total Net</TableHead>
                <TableHead>Valeur Immob.</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStock.map(item => {
                const netAvailable = item.aggregate - item.reserved - item.allocated;
                return (
                  <TableRow key={item.sku} className="cursor-pointer hover:bg-muted/30" onClick={() => handleSelectSku(item.sku)}>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.brand}</div>
                      <div className="text-xs text-muted-foreground">{item.type}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.location}</TableCell>
                    <TableCell className="text-right font-serif">{netAvailable} <span className="text-xs text-muted-foreground font-sans">/ {item.aggregate}</span></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.immobilizedValueXAF > 0 ? formatFCFA(item.immobilizedValueXAF) : '-'}</TableCell>
                    <TableCell>
                      {item.aggregate > 50 ? <Badge variant="success">Sain</Badge> : item.aggregate > 0 ? <Badge variant="warning">Bas</Badge> : <Badge variant="destructive">Rupture</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectSku(item.sku); }}>Tracer</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredStock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground border-dashed">
                    Aucun résultat dans l'inventaire.
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
