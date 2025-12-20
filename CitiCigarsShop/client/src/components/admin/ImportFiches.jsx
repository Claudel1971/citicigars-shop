import React, { useState, useMemo } from 'react';
import { useProducts } from '@/context/ProductContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, Search, Save, Check, X, RefreshCw } from 'lucide-react';
import apiService from '@/services/apiService';

export default function ImportFiches() {
  const { products, refreshProducts } = useProducts();
  const [ficheText, setFicheText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [selectedSku, setSelectedSku] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const parseFiche = (text) => {
    const data = {
      marque: '',
      ligne: '',
      format: '',
      dimensions: '',
      puissance: 0,
      duree: '',
      terroir: {
        origine: '',
        cape: '',
        sousCape: '',
        tripe: ''
      },
      combustion: {
        cape: '',
        construction: '',
        tirage: '',
        combustion: '',
        cendre: '',
        fumee: ''
      },
      aromes: {
        dominantes: '',
        secondaires: '',
        evolution: ''
      },
      evaluation: {
        positionnement: '',
        note: '',
        top25: ''
      },
      impressions: ''
    };

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      
      if (lower.includes('marque') && line.includes(':')) {
        data.marque = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('ligne') && line.includes(':')) {
        data.ligne = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('format') && line.includes(':') && !lower.includes('dimensions')) {
        data.format = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('dimensions') && line.includes(':')) {
        data.dimensions = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('puissance') && line.includes(':')) {
        const puissanceText = line.split(':').slice(1).join(':').trim();
        const fireCount = (puissanceText.match(/🔥/g) || []).length;
        data.puissance = fireCount || parseInt(puissanceText) || 0;
      }
      if ((lower.includes('durée') || lower.includes('duree')) && line.includes(':')) {
        data.duree = line.split(':').slice(1).join(':').trim();
      }
      
      if (lower.includes('origine') && line.includes(':')) {
        data.terroir.origine = line.split(':').slice(1).join(':').trim().replace(/🇳🇮|🇨🇺|🇭🇳|🇩🇴|🇪🇨/g, '').trim();
      }
      if (lower.includes('cape') && !lower.includes('sous') && line.includes(':')) {
        const val = line.split(':').slice(1).join(':').trim().replace(/🇳🇮|🇨🇺|🇭🇳|🇩🇴|🇪🇨/g, '').trim();
        if (lower.includes('✅') || lower.includes('combustion')) {
          data.combustion.cape = val;
        } else {
          data.terroir.cape = val;
        }
      }
      if (lower.includes('sous-cape') && line.includes(':')) {
        data.terroir.sousCape = line.split(':').slice(1).join(':').trim().replace(/🇳🇮|🇨🇺|🇭🇳|🇩🇴|🇪🇨/g, '').trim();
      }
      if (lower.includes('tripe') && line.includes(':')) {
        data.terroir.tripe = line.split(':').slice(1).join(':').trim().replace(/🇳🇮|🇨🇺|🇭🇳|🇩🇴|🇪🇨/g, '').trim();
      }
      
      if (lower.includes('construction') && line.includes(':')) {
        data.combustion.construction = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('tirage') && line.includes(':')) {
        data.combustion.tirage = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('combustion') && line.includes(':') && !lower.includes('aspect')) {
        data.combustion.combustion = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('cendre') && line.includes(':')) {
        data.combustion.cendre = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('fumée') || lower.includes('fumee')) {
        if (line.includes(':')) {
          data.combustion.fumee = line.split(':').slice(1).join(':').trim();
        }
      }
      
      if (lower.includes('dominantes') && line.includes(':')) {
        data.aromes.dominantes = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('secondaires') && line.includes(':')) {
        data.aromes.secondaires = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('évolution') || lower.includes('evolution')) {
        if (line.includes(':')) {
          data.aromes.evolution = line.split(':').slice(1).join(':').trim();
        }
      }
      
      if (lower.includes('positionnement') && line.includes(':')) {
        data.evaluation.positionnement = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('note') && lower.includes('source') && line.includes(':')) {
        data.evaluation.note = line.split(':').slice(1).join(':').trim();
      }
      if (lower.includes('top 25') && line.includes(':')) {
        data.evaluation.top25 = line.split(':').slice(1).join(':').trim();
      }
      
      if (lower.includes('impressions') || (lower.includes('😃') && line.length > 50)) {
        const impressionStart = text.indexOf(line);
        if (impressionStart !== -1) {
          data.impressions = line.replace('😃', '').trim();
        }
      }
    }

    return data;
  };

  const handleParse = () => {
    if (!ficheText.trim()) {
      toast.error('Collez le contenu de la fiche');
      return;
    }
    const parsed = parseFiche(ficheText);
    setParsedData(parsed);
    
    const marqueSearch = parsed.marque.toLowerCase();
    const ligneSearch = parsed.ligne.toLowerCase();
    const match = products.find(p => 
      p.marque?.toLowerCase().includes(marqueSearch) &&
      (p.ligne?.toLowerCase().includes(ligneSearch) || p.modele?.toLowerCase().includes(ligneSearch))
    );
    if (match) {
      setSelectedSku(match.sku);
      toast.success(`Produit trouvé : ${match.marque} ${match.ligne || match.modele}`);
    } else {
      toast.info('Aucun produit correspondant trouvé. Sélectionnez manuellement.');
    }
  };

  const handleSave = async () => {
    if (!selectedSku || !parsedData) {
      toast.error('Sélectionnez un produit et parsez une fiche');
      return;
    }

    setSaving(true);
    try {
      await apiService.updateProduct(selectedSku, {
        ficheTechnique: parsedData
      });
      toast.success('Fiche technique enregistrée !');
      await refreshProducts();
      setFicheText('');
      setParsedData(null);
      setSelectedSku('');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.marque?.toLowerCase().includes(q) ||
      p.ligne?.toLowerCase().includes(q) ||
      p.modele?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [products, searchQuery]);

  const selectedProduct = products.find(p => p.sku === selectedSku);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Import Fiches Techniques
        </h1>
        <p className="text-muted-foreground">
          Collez le contenu d'une fiche technique pour l'associer à un produit.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">1. Collez la fiche technique :</label>
            <textarea
              value={ficheText}
              onChange={(e) => setFicheText(e.target.value)}
              placeholder="Collez ici le contenu complet de la fiche (Word, texte...)..."
              className="w-full h-64 p-3 border rounded-lg font-mono text-sm resize-none"
            />
          </div>
          
          <Button onClick={handleParse} className="w-full">
            <Search className="w-4 h-4 mr-2" />
            Analyser la fiche
          </Button>

          {parsedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-bold text-green-800 mb-2">Données extraites :</h3>
              <div className="text-sm space-y-1">
                <p><strong>Marque :</strong> {parsedData.marque || '-'}</p>
                <p><strong>Ligne :</strong> {parsedData.ligne || '-'}</p>
                <p><strong>Format :</strong> {parsedData.format || '-'}</p>
                <p><strong>Puissance :</strong> {'🔥'.repeat(parsedData.puissance) || '-'}</p>
                <p><strong>Durée :</strong> {parsedData.duree || '-'}</p>
                <p><strong>Origine :</strong> {parsedData.terroir.origine || '-'}</p>
                <p><strong>Cape :</strong> {parsedData.terroir.cape || '-'}</p>
                <p><strong>Arômes :</strong> {parsedData.aromes.dominantes || '-'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">2. Sélectionnez le produit :</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par marque, ligne, SKU..."
              className="w-full p-2 border rounded-lg mb-2"
            />
            
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredProducts.map(p => (
                <div
                  key={p.sku}
                  onClick={() => setSelectedSku(p.sku)}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 flex justify-between items-center ${
                    selectedSku === p.sku ? 'bg-primary/10 border-primary' : ''
                  }`}
                >
                  <div>
                    <p className="font-medium">{p.marque} {p.ligne || p.modele}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  {selectedSku === p.sku && <Check className="w-5 h-5 text-primary" />}
                  {p.ficheTechnique && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Fiche OK</span>}
                </div>
              ))}
            </div>
          </div>

          {selectedProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-blue-800 mb-2">Produit sélectionné :</h3>
              <p><strong>{selectedProduct.marque}</strong> {selectedProduct.ligne || selectedProduct.modele}</p>
              <p className="text-sm text-muted-foreground">{selectedProduct.sku}</p>
              <p className="text-sm">{selectedProduct.pays} • {selectedProduct.vitole}</p>
            </div>
          )}

          <Button 
            onClick={handleSave} 
            disabled={!selectedSku || !parsedData || saving}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Sauvegarder la fiche
          </Button>
        </div>
      </div>
    </div>
  );
}
