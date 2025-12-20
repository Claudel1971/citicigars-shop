import React, { useState, useMemo } from 'react';
import { useProducts } from '@/context/ProductContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, Search, Save, Check, X, RefreshCw, Edit3 } from 'lucide-react';
import apiService from '@/services/apiService';

export default function ImportFiches() {
  const { products, refreshProducts } = useProducts();
  const [ficheText, setFicheText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [editableData, setEditableData] = useState(null);
  const [selectedSku, setSelectedSku] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
        aspectCape: '',
        construction: '',
        coupe: '',
        allumage: '',
        tirage: '',
        combustion: '',
        cendre: ''
      },
      aromes: {
        fumee: '',
        dominantes: '',
        secondaires: '',
        evolution: ''
      },
      degustation: {
        positionnement: '',
        impressions: ''
      }
    };

    const cleanEmojis = (str) => str.replace(/🔸|✅|⭐|😃|🔥|🇳🇮|🇨🇺|🇭🇳|🇩🇴|🇪🇨|🇺🇸|🌍|🌿|💨|🎯|📊|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣|🔟|📦|🧾|💵|🏆|🥇|🥈|🥉/g, '').trim();
    
    const extractValue = (line) => {
      if (!line.includes(':')) return '';
      return cleanEmojis(line.split(':').slice(1).join(':').trim());
    };

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let currentSection = '';
    const sectionHeaders = {
      'caractéristiques': 'caracteristiques',
      'caracteristiques': 'caracteristiques',
      'techniques': 'caracteristiques',
      'terroir': 'terroir',
      'origine': 'terroir',
      'aspect': 'combustion',
      'combustion': 'combustion',
      'aromatique': 'aromes',
      'palette': 'aromes',
      'arômes': 'aromes',
      'aromes': 'aromes',
      'évaluation': 'evaluation',
      'evaluation': 'evaluation',
      'impressions': 'degustation',
      'dégustation': 'degustation'
    };

    let typeFumee = '';
    let fumeeValue = '';
    
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
        if (currentSection === 'degustation' && line.length > 20) {
          data.degustation.impressions += (data.degustation.impressions ? ' ' : '') + cleanEmojis(line);
        }
        continue;
      }
      
      const value = extractValue(line);
      if (!value) continue;
      
      if (cleanLower.includes('type de fumée') || cleanLower.includes('type de fumee')) {
        typeFumee = value;
      } else if ((cleanLower.includes('fumée') || cleanLower.includes('fumee')) && !cleanLower.includes('type')) {
        fumeeValue = value;
      } else if (cleanLower.includes('durée') || cleanLower.includes('duree')) {
        data.combustion.duree = value;
      } else if (cleanLower.includes('origine')) {
        data.terroir.origine = value;
      } else if (cleanLower.includes('sous-cape') || cleanLower.includes('sous cape')) {
        data.terroir.sousCape = value;
      } else if (cleanLower.includes('cape') && currentSection === 'combustion') {
        data.combustion.aspectCape = value;
      } else if (cleanLower.includes('cape') && (currentSection === 'terroir' || !data.terroir.cape)) {
        data.terroir.cape = value;
      } else if (cleanLower.includes('tripe')) {
        data.terroir.tripe = value;
      } else if (cleanLower.includes('construction')) {
        data.combustion.construction = value;
      } else if (cleanLower.includes('coupe')) {
        data.combustion.coupe = value;
      } else if (cleanLower.includes('allumage')) {
        data.combustion.allumage = value;
      } else if (cleanLower.includes('tirage')) {
        data.combustion.tirage = value;
      } else if (cleanLower.includes('combustion') && !cleanLower.includes('aspect')) {
        data.combustion.combustion = value;
      } else if (cleanLower.includes('cendre')) {
        data.combustion.cendre = value;
      } else if (cleanLower.includes('dominantes') || cleanLower.includes('notes dominantes')) {
        data.aromes.dominantes = value;
      } else if (cleanLower.includes('secondaires') || cleanLower.includes('nuances')) {
        data.aromes.secondaires = value;
      } else if (cleanLower.includes('évolution') || cleanLower.includes('evolution')) {
        data.aromes.evolution = value;
      } else if (cleanLower.includes('positionnement')) {
        data.degustation.positionnement = value;
      }
    }
    
    if (typeFumee && fumeeValue && typeFumee !== fumeeValue) {
      data.aromes.fumee = `${typeFumee} • ${fumeeValue}`;
    } else {
      data.aromes.fumee = typeFumee || fumeeValue;
    }
    
    if (!data.degustation.impressions) {
      const impressionIdx = lines.findIndex(l => 
        l.toLowerCase().includes('impression') || 
        l.toLowerCase().includes('dégustation') ||
        l.includes('😃')
      );
      if (impressionIdx !== -1) {
        const impressionLines = lines.slice(impressionIdx + 1).filter(l => l.length > 20 && !l.includes(':'));
        data.degustation.impressions = impressionLines.map(l => cleanEmojis(l)).join(' ').trim();
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
    setEditableData(JSON.parse(JSON.stringify(parsed)));
    setIsEditing(false);
    toast.success('Fiche analysée ! Vérifiez et modifiez si nécessaire.');
  };

  const handleFieldChange = (section, field, value) => {
    setEditableData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleCancel = () => {
    setEditableData(JSON.parse(JSON.stringify(parsedData)));
    setIsEditing(false);
    toast.info('Modifications annulées');
  };

  const handleSave = async () => {
    if (!selectedSku || !editableData) {
      toast.error('Sélectionnez un produit et parsez une fiche');
      return;
    }

    setSaving(true);
    try {
      await apiService.updateProduct(selectedSku, {
        ficheTechnique: editableData
      });
      toast.success('Fiche technique enregistrée !');
      await refreshProducts();
      setFicheText('');
      setParsedData(null);
      setEditableData(null);
      setSelectedSku('');
      setIsEditing(false);
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

  const renderField = (section, field, label) => {
    const value = editableData?.[section]?.[field] || '';
    const isLongText = field === 'impressions' || field === 'positionnement';
    
    return (
      <div key={`${section}-${field}`} className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {isLongText ? (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(section, field, e.target.value)}
            className="w-full p-2 text-sm border rounded resize-none h-20"
            placeholder={`Entrez ${label.toLowerCase()}...`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(section, field, e.target.value)}
            className="w-full p-2 text-sm border rounded"
            placeholder={`Entrez ${label.toLowerCase()}...`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Import Fiches Techniques
        </h1>
        <p className="text-muted-foreground">
          Collez le contenu d'une fiche technique, modifiez si nécessaire, puis associez à un produit.
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
              className="w-full h-48 p-3 border rounded-lg font-mono text-sm resize-none"
            />
          </div>
          
          <Button onClick={handleParse} className="w-full">
            <Search className="w-4 h-4 mr-2" />
            Analyser la fiche
          </Button>

          {editableData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-green-800">Données extraites :</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  {isEditing ? 'Aperçu' : 'Modifier'}
                </Button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="border-b pb-3">
                  <p className="font-semibold text-green-700 mb-2">🌍 Terroir</p>
                  <div className="grid grid-cols-1 gap-2">
                    {renderField('terroir', 'origine', 'Origine')}
                    {renderField('terroir', 'cape', 'Cape')}
                    {renderField('terroir', 'sousCape', 'Sous-cape')}
                    {renderField('terroir', 'tripe', 'Tripe')}
                  </div>
                </div>
                
                <div className="border-b pb-3">
                  <p className="font-semibold text-green-700 mb-2">🔥 Combustion</p>
                  <div className="grid grid-cols-2 gap-2">
                    {renderField('combustion', 'duree', 'Durée')}
                    {renderField('combustion', 'aspectCape', 'Aspect cape')}
                    {renderField('combustion', 'construction', 'Construction')}
                    {renderField('combustion', 'coupe', 'Coupe')}
                    {renderField('combustion', 'allumage', 'Allumage')}
                    {renderField('combustion', 'tirage', 'Tirage')}
                    {renderField('combustion', 'combustion', 'Combustion')}
                    {renderField('combustion', 'cendre', 'Cendre')}
                  </div>
                </div>
                
                <div className="border-b pb-3">
                  <p className="font-semibold text-green-700 mb-2">🌿 Arômes</p>
                  <div className="grid grid-cols-1 gap-2">
                    {renderField('aromes', 'fumee', 'Fumée')}
                    {renderField('aromes', 'dominantes', 'Notes dominantes')}
                    {renderField('aromes', 'secondaires', 'Nuances secondaires')}
                    {renderField('aromes', 'evolution', 'Évolution')}
                  </div>
                </div>
                
                <div>
                  <p className="font-semibold text-green-700 mb-2">🍷 Dégustation</p>
                  <div className="grid grid-cols-1 gap-2">
                    {renderField('degustation', 'positionnement', 'Positionnement')}
                    {renderField('degustation', 'impressions', 'Impressions')}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
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
            disabled={!selectedSku || !editableData || saving}
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
