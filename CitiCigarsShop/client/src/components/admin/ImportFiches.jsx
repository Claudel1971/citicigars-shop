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
      terroir: {
        origine: '',
        cape: '',
        sousCape: '',
        tripe: ''
      },
      combustion: {
        duree: '',
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
      impressions: ''
    };

    const cleanEmojis = (str) => str.replace(/🔸|✅|⭐|😃|🔥|🇳🇮|🇨🇺|🇭🇳|🇩🇴|🇪🇨|🌍|🌿|💨|🎯|📊|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟/g, '').trim();
    
    const extractValue = (line) => {
      if (!line.includes(':')) return '';
      return cleanEmojis(line.split(':').slice(1).join(':').trim());
    };

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let currentSection = '';
    const sectionHeaders = {
      'terroir': 'terroir',
      'origine': 'terroir',
      'aspect': 'combustion',
      'combustion': 'combustion',
      'aromatique': 'aromes',
      'palette': 'aromes',
      'arômes': 'aromes',
      'aromes': 'aromes',
      'impressions': 'impressions',
      'dégustation': 'impressions'
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      const cleanLower = cleanEmojis(lower);
      
      const isSectionHeader = /^(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟|\d+[\.\)]?\s)/.test(line) || 
                              /^(#{1,3}\s)/.test(line) ||
                              Object.keys(sectionHeaders).some(h => cleanLower.includes(h) && !line.includes(':'));
      
      if (isSectionHeader) {
        for (const [keyword, section] of Object.entries(sectionHeaders)) {
          if (cleanLower.includes(keyword)) {
            currentSection = section;
            break;
          }
        }
        continue;
      }
      
      if (!line.includes(':')) {
        if (currentSection === 'impressions' && line.length > 20) {
          data.impressions += (data.impressions ? ' ' : '') + cleanEmojis(line);
        }
        continue;
      }
      
      const value = extractValue(line);
      if (!value) continue;
      
      if (cleanLower.includes('origine')) {
        data.terroir.origine = value;
      } else if (cleanLower.includes('sous-cape') || cleanLower.includes('sous cape')) {
        data.terroir.sousCape = value;
      } else if (cleanLower.includes('cape') && (currentSection === 'terroir' || !data.terroir.cape)) {
        data.terroir.cape = value;
      } else if (cleanLower.includes('tripe')) {
        data.terroir.tripe = value;
      } else if (cleanLower.includes('durée') || cleanLower.includes('duree') || cleanLower.includes('temps')) {
        data.combustion.duree = value;
      } else if (cleanLower.includes('construction')) {
        data.combustion.construction = value;
      } else if (cleanLower.includes('tirage')) {
        data.combustion.tirage = value;
      } else if (cleanLower.includes('combustion') && !cleanLower.includes('aspect')) {
        data.combustion.combustion = value;
      } else if (cleanLower.includes('cendre')) {
        data.combustion.cendre = value;
      } else if (cleanLower.includes('fumée') || cleanLower.includes('fumee')) {
        data.combustion.fumee = value;
      } else if (cleanLower.includes('dominantes') || cleanLower.includes('notes dominantes')) {
        data.aromes.dominantes = value;
      } else if (cleanLower.includes('secondaires') || cleanLower.includes('nuances')) {
        data.aromes.secondaires = value;
      } else if (cleanLower.includes('évolution') || cleanLower.includes('evolution')) {
        data.aromes.evolution = value;
      }
    }
    
    if (!data.impressions) {
      const impressionIdx = lines.findIndex(l => 
        l.toLowerCase().includes('impression') || 
        l.toLowerCase().includes('dégustation') ||
        l.includes('😃')
      );
      if (impressionIdx !== -1) {
        const impressionLines = lines.slice(impressionIdx + 1).filter(l => l.length > 20 && !l.includes(':'));
        data.impressions = impressionLines.map(l => cleanEmojis(l)).join(' ').trim();
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
    toast.success('Fiche analysée ! Sélectionnez le produit correspondant.');
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
              <div className="text-sm space-y-2">
                <div>
                  <p className="font-semibold text-green-700">Terroir :</p>
                  <p>Origine : {parsedData.terroir.origine || '-'}</p>
                  <p>Cape : {parsedData.terroir.cape || '-'}</p>
                  <p>Sous-cape : {parsedData.terroir.sousCape || '-'}</p>
                  <p>Tripe : {parsedData.terroir.tripe || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-green-700">Combustion :</p>
                  <p>Durée : {parsedData.combustion.duree || '-'}</p>
                  <p>Tirage : {parsedData.combustion.tirage || '-'}</p>
                  <p>Combustion : {parsedData.combustion.combustion || '-'}</p>
                  <p>Cendre : {parsedData.combustion.cendre || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold text-green-700">Arômes :</p>
                  <p>Dominantes : {parsedData.aromes.dominantes || '-'}</p>
                  <p>Secondaires : {parsedData.aromes.secondaires || '-'}</p>
                </div>
                {parsedData.impressions && (
                  <div>
                    <p className="font-semibold text-green-700">Impressions :</p>
                    <p className="text-xs">{parsedData.impressions.slice(0, 150)}...</p>
                  </div>
                )}
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
