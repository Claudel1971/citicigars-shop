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
        
        if (json.length > 0) {
          console.log('Colonnes Excel:', Object.keys(json[0]));
          console.log('Premiere ligne:', json[0]);
        }

        const transformed = json.map(row => {
          const keys = Object.keys(row);
          const sku = row.SKU || row.sku || row.Sku || '';
          const existingProduct = products.find(p => p.sku === sku);
          
          const findCol = (patterns) => {
            for (const key of keys) {
              const keyLower = key.toLowerCase();
              for (const p of patterns) {
                if (keyLower.includes(p.toLowerCase())) {
                  return row[key];
                }
              }
            }
            return null;
          };

          const prixUnitaire = findCol(['citicigar', 'prix unit']);
          const prixPromo = findCol(['p.u. promo', 'promo (cf', 'prix promo unit']);
          const prixBoite = findCol(['promo box', 'prix box']);
          const prixPack = findCol(['promo pack', 'prix pack']);
          const rabaisRaw = findCol(['rabais']);

          let rabais = 0;
          if (rabaisRaw !== null) {
            if (typeof rabaisRaw === 'number') {
              rabais = Math.abs(rabaisRaw) < 1 ? Math.abs(rabaisRaw) * 100 : Math.abs(rabaisRaw);
            } else if (typeof rabaisRaw === 'string') {
              rabais = Math.abs(parseFloat(rabaisRaw.replace('%', '').replace('-', '')) || 0);
            }
          }

          return {
            sku,
            exists: !!existingProduct,
            currentProduct: existingProduct,
            prixUnitaire: prixUnitaire !== null ? prixUnitaire : null,
            prixPromo: prixPromo !== null ? prixPromo : null,
            prixPack: prixPack !== null ? prixPack : null,
            prixBoite: prixBoite !== null ? prixBoite : null,
            rabais: Math.round(rabais),
          };
        });

        setPreview(transformed);
        setFile(file);
        
        const existCount = transformed.filter(r => r.exists).length;
        toast.success(`${transformed.length} lignes. ${existCount} produits trouves.`);
      } catch (error) {
        toast.error("Erreur lecture fichier Excel.");
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
      toast.error("Aucun produit valide");
      return;
    }

    setIsProcessing(true);
    
    try {
      const updates = validUpdates.map(r => {
        const update = { sku: r.sku };
        
        if (r.prixUnitaire !== null) update.prixUnitaire = r.prixUnitaire;
        if (r.prixPack !== null) update.prixPack = r.prixPack;
        if (r.prixBoite !== null) update.prixBoite = r.prixBoite;
        
        if (r.rabais > 0 || r.prixPromo !== null) {
          const prixUnitaire = r.prixUnitaire ?? r.currentProduct?.prixUnitaire ?? 0;
          const calculatedPromo = r.prixPromo !== null 
            ? r.prixPromo 
            : (r.rabais > 0 && prixUnitaire > 0) 
              ? Math.round(prixUnitaire * (1 - r.rabais / 100) / 250) * 250 
              : null;
          update.promotions = {
            unitaire: { 
              actif: true, 
              pourcentage: r.rabais,
              prixPromo: calculatedPromo
            },
            pack: { actif: false, pourcentage: 0 },
            boite: { actif: false, pourcentage: 0 }
          };
        }
        
        return update;
      });

      const result = await apiService.bulkUpdatePrices(updates);
      
      setResults(result);
      await refreshProducts();
      
      toast.success(`${result.updated} produits mis a jour!`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur mise a jour");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPreview([]);
    setFile(null);
    setResults(null);
  };

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === '' || price === 0) return '-';
    return `${Number(price).toLocaleString('fr-FR')} FCFA`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-serif font-bold text-primary">Mise a Jour des Prix (Excel)</h2>
        <p className="text-muted-foreground mt-1">Importez votre fichier Excel - les valeurs sont utilisees telles quelles</p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-blue-900 mb-2">Colonnes reconnues:</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><code className="bg-blue-100 px-1 rounded">SKU</code></li>
            <li><code className="bg-blue-100 px-1 rounded">prix CitiCigar</code> → Prix unitaire</li>
            <li><code className="bg-blue-100 px-1 rounded">Rabais promo</code> → % rabais</li>
            <li><code className="bg-blue-100 px-1 rounded">p.u. promo</code> → Prix unitaire promo</li>
            <li><code className="bg-blue-100 px-1 rounded">Prix Promo box</code> → Prix boite</li>
            <li><code className="bg-blue-100 px-1 rounded">Prix Promo pack</code> → Prix pack</li>
          </ul>
        </div>
      </div>

      {results ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600" size={32} />
              <div>
                <h3 className="text-lg font-semibold text-green-800">Mise a jour terminee!</h3>
                <p className="text-green-700">{results.updated} produits mis a jour</p>
              </div>
            </div>
            
            {results.notFound?.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {results.notFound.length} SKU non trouves:
                </p>
                <p className="text-xs text-yellow-700 mt-1">{results.notFound.join(', ')}</p>
              </div>
            )}
          </div>
          
          <Button onClick={handleReset} className="w-full">
            <RefreshCw size={16} className="mr-2" />
            Nouvelle importation
          </Button>
        </div>
      ) : preview.length === 0 ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Deposez le fichier ici...' : 'Glissez votre fichier Excel ici'}
          </p>
          <p className="text-sm text-gray-500 mt-2">ou cliquez pour selectionner</p>
          <p className="text-xs text-gray-400 mt-4">Formats acceptes: .xlsx, .xls, .csv</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-green-600" size={24} />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-gray-500">{preview.length} lignes</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <XCircle size={16} className="mr-1" />
              Annuler
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Produit</th>
                    <th className="px-3 py-2 text-right">Prix Unit.</th>
                    <th className="px-3 py-2 text-right">Rabais %</th>
                    <th className="px-3 py-2 text-right">Prix Promo</th>
                    <th className="px-3 py-2 text-right">Prix Pack</th>
                    <th className="px-3 py-2 text-right">Prix Boite</th>
                    <th className="px-3 py-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className={`border-t ${!row.exists ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-3 py-2">
                        {row.exists ? `${row.currentProduct?.marque} - ${row.currentProduct?.modele}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right">{formatPrice(row.prixUnitaire)}</td>
                      <td className="px-3 py-2 text-right">{row.rabais > 0 ? `${row.rabais}%` : '-'}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(row.prixPromo)}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(row.prixPack)}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(row.prixBoite)}</td>
                      <td className="px-3 py-2 text-center">
                        {row.exists ? (
                          <span className="text-green-600 flex items-center justify-center gap-1">
                            <CheckCircle size={14} /> OK
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center justify-center gap-1">
                            <XCircle size={14} /> Non trouve
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Annuler
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={isProcessing || preview.filter(r => r.exists).length === 0}
              className="flex-1"
            >
              {isProcessing ? 'Mise a jour...' : `Confirmer (${preview.filter(r => r.exists).length} produits)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePricesExcel;
