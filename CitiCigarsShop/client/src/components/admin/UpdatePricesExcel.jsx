import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useProducts } from '@/context/ProductContext';
import { toast } from 'sonner';
import apiService from '@/services/apiService';
import Button from '../shared/Button';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

const UpdatePricesExcel = () => {
  const { products, refreshProducts } = useProducts();
  const [preview, setPreview] = useState([]);
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const parseExcel = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        // Debug: log the actual column names from Excel
        if (json.length > 0) {
          console.log('📊 Colonnes Excel détectées:', Object.keys(json[0]));
          console.log('📊 Première ligne:', json[0]);
        }
        
        // Helper function to find value by partial key match
        const findValue = (row, patterns) => {
          const keys = Object.keys(row);
          for (const pattern of patterns) {
            // First try exact match
            if (row[pattern] !== undefined) return row[pattern];
            // Then try partial match (case-insensitive)
            const patternLower = pattern.toLowerCase();
            for (const key of keys) {
              if (key.toLowerCase().includes(patternLower) || patternLower.includes(key.toLowerCase())) {
                return row[key];
              }
            }
          }
          return null;
        };

        const transformed = json.map(row => {
          const sku = row.SKU || row.sku || row.Sku || '';
          const existingProduct = products.find(p => p.sku === sku);
          
          const prixUnitaireReg = parseFloat(
            findValue(row, ['prix CitiCigar', 'prix CitiCigars', 'prixUnitaire', 'Prix_Unit']) || 0
          );
          
          let rabaisPromoStr = findValue(row, ['Rabais promo', 'rabais', 'promo']) || '0%';
          if (typeof rabaisPromoStr === 'string') {
            rabaisPromoStr = rabaisPromoStr.replace('%', '').replace('-', '');
          }
          const rabaisPromo = Math.abs(parseFloat(rabaisPromoStr) || 0);
          
          const prixUnitairePromo = parseFloat(
            findValue(row, ['p.u. promo', 'prix promo', 'prixPromo']) || 0
          );
          
          const prixPack = parseFloat(
            findValue(row, ['promo pack', 'prix pack', 'prixPack']) || 0
          );
          
          const prixBoite = parseFloat(
            findValue(row, ['promo box', 'prix box', 'boite', 'prixBoite']) || 0
          );

          const hasPromo = rabaisPromo > 0 || prixUnitairePromo > 0;

          return {
            sku,
            exists: !!existingProduct,
            currentProduct: existingProduct,
            prixUnitaire: prixUnitaireReg || null,
            prixPack: prixPack || null,
            prixBoite: prixBoite || null,
            rabaisPromo: rabaisPromo || 0,
            prixUnitairePromo: prixUnitairePromo || 0,
            hasPromo,
            promotions: hasPromo ? {
              unitaire: { 
                actif: rabaisPromo > 0, 
                pourcentage: rabaisPromo 
              },
              pack: { actif: false, pourcentage: 0 },
              boite: { actif: false, pourcentage: 0 }
            } : null,
          };
        });

        setPreview(transformed);
        setFile(file);
        
        const existCount = transformed.filter(r => r.exists).length;
        const notFoundCount = transformed.filter(r => !r.exists).length;
        
        toast.success(`${transformed.length} lignes analysees. ${existCount} produits trouves, ${notFoundCount} non trouves.`);
      } catch (error) {
        toast.error("Erreur lors de la lecture du fichier Excel.");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [products]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      parseExcel(file);
    }
  }, [parseExcel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    }
  });

  const handleConfirm = async () => {
    const validUpdates = preview.filter(r => r.exists && r.sku);
    
    if (validUpdates.length === 0) {
      toast.error("Aucun produit valide a mettre a jour");
      return;
    }

    setIsProcessing(true);
    
    try {
      const updates = validUpdates.map(r => ({
        sku: r.sku,
        prixUnitaire: r.prixUnitaire,
        prixPack: r.prixPack,
        prixBoite: r.prixBoite,
        promotions: r.promotions,
      }));

      const result = await apiService.bulkUpdatePrices(updates);
      
      setResults(result);
      await refreshProducts();
      
      toast.success(`${result.updated} produits mis a jour avec succes!`);
    } catch (error) {
      console.error("Error updating prices:", error);
      toast.error("Erreur lors de la mise a jour des prix");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResults(null);
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-primary">Mise a Jour des Prix (Excel)</h2>
        <p className="text-muted-foreground mt-1">Importez un fichier Excel pour mettre a jour les prix en bloc</p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-blue-900 mb-2">Format du fichier Excel attendu:</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>Colonnes reconnues:</strong></p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><code className="bg-blue-100 px-1 rounded">SKU</code> - Code produit (obligatoire)</li>
            <li><code className="bg-blue-100 px-1 rounded">prix CitiCigar</code> - Prix unitaire regulier</li>
            <li><code className="bg-blue-100 px-1 rounded">Rabais promo</code> - Rabais en % (ex: -5%, 0%)</li>
            <li><code className="bg-blue-100 px-1 rounded">p.u. promo</code> - Prix unitaire promo</li>
            <li><code className="bg-blue-100 px-1 rounded">Prix Promo box</code> - Prix de la boite</li>
            <li><code className="bg-blue-100 px-1 rounded">Prix Promo pack</code> - Prix du pack</li>
          </ul>
        </div>
      </div>

      {results ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600 h-8 w-8" />
              <div>
                <h3 className="text-lg font-bold text-green-800">Mise a jour terminee!</h3>
                <p className="text-green-700">{results.updated} produits mis a jour</p>
              </div>
            </div>
            
            {results.notFound?.length > 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="font-medium text-yellow-800 mb-2">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  {results.notFound.length} SKU non trouves:
                </p>
                <p className="text-sm text-yellow-700">{results.notFound.join(', ')}</p>
              </div>
            )}
            
            {results.errors?.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="font-medium text-red-800 mb-2">
                  <XCircle className="inline h-4 w-4 mr-1" />
                  Erreurs:
                </p>
                <ul className="text-sm text-red-700">
                  {results.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
          
          <Button onClick={reset} className="gap-2">
            <RefreshCw size={16} /> Nouvelle mise a jour
          </Button>
        </div>
      ) : !file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragActive ? 'border-secondary bg-secondary/10' : 'border-border hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-primary">Glissez votre fichier Excel ici</p>
          <p className="text-sm text-muted-foreground">ou cliquez pour selectionner (.xlsx, .xls, .csv)</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-green-600 h-8 w-8" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {preview.filter(r => r.exists).length} produits a mettre a jour sur {preview.length} lignes
                </p>
              </div>
            </div>
            <button onClick={reset} className="text-sm text-destructive hover:underline">
              Changer de fichier
            </button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Produit</th>
                    <th className="p-3 text-right">Prix Unit.</th>
                    <th className="p-3 text-right">Promo %</th>
                    <th className="p-3 text-right">Prix Pack</th>
                    <th className="p-3 text-right">Prix Boite</th>
                    <th className="p-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 15).map((row, i) => (
                    <tr key={i} className={`border-t ${!row.exists ? 'bg-red-50' : row.hasPromo ? 'bg-yellow-50' : ''}`}>
                      <td className="p-3 font-mono text-xs">{row.sku}</td>
                      <td className="p-3 text-sm">
                        {row.exists ? (
                          <span>{row.currentProduct?.marque} - {row.currentProduct?.modele}</span>
                        ) : (
                          <span className="text-red-500 italic">Non trouve</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-sm">{formatPrice(row.prixUnitaire)}</td>
                      <td className="p-3 text-right text-sm">
                        {row.rabaisPromo > 0 ? (
                          <span className="text-orange-600 font-medium">-{row.rabaisPromo}%</span>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-right text-sm">{formatPrice(row.prixPack)}</td>
                      <td className="p-3 text-right text-sm">{formatPrice(row.prixBoite)}</td>
                      <td className="p-3 text-center">
                        {row.exists ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle size={14} /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500">
                            <XCircle size={14} /> Erreur
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 15 && (
              <div className="p-2 text-center text-xs text-muted-foreground bg-muted/10">
                ...et {preview.length - 15} autres lignes
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-800 mb-2">Resume:</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>Produits a mettre a jour: <strong>{preview.filter(r => r.exists).length}</strong></li>
              <li>SKU non trouves (ignores): <strong>{preview.filter(r => !r.exists).length}</strong></li>
              <li>Produits avec promotion: <strong>{preview.filter(r => r.exists && r.hasPromo).length}</strong></li>
            </ul>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={reset}>Annuler</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={isProcessing || preview.filter(r => r.exists).length === 0}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Mise a jour en cours...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Confirmer la mise a jour ({preview.filter(r => r.exists).length} produits)
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePricesExcel;
