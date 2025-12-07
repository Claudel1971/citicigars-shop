import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useProducts } from '@/context/ProductContext';
import { toast } from 'sonner';
import apiService from '@/services/apiService';
import Button from '../shared/Button';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, RefreshCw, Flame } from 'lucide-react';

const getPuissanceLabel = (puissance) => {
  const labels = {
    1: "Léger",
    2: "Léger-Moyen",
    3: "Moyen",
    4: "Medium-Full",
    5: "Corsé",
  };
  return labels[puissance] || "-";
};

const PuissanceDisplay = ({ value }) => {
  if (!value || value < 1 || value > 5) return <span className="text-gray-400">-</span>;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((niveau) => (
          <div
            key={niveau}
            className={`w-3 h-1.5 rounded-[1px] border ${
              niveau <= value
                ? "bg-orange-500 border-orange-500"
                : "bg-transparent border-gray-300"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-600">{getPuissanceLabel(value)}</span>
    </div>
  );
};

const UpdatePuissanceExcel = () => {
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

          const puissanceRaw = findCol(['puissance', 'strength', 'force', 'intensite']);
          
          let puissance = null;
          if (puissanceRaw !== null && puissanceRaw !== undefined && puissanceRaw !== '') {
            const parsed = parseInt(puissanceRaw, 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
              puissance = parsed;
            }
          }

          return {
            sku,
            exists: !!existingProduct,
            currentProduct: existingProduct,
            currentPuissance: existingProduct?.puissance || null,
            newPuissance: puissance,
            hasChange: puissance !== null && puissance !== existingProduct?.puissance,
          };
        }).filter(r => r.sku);

        setPreview(transformed);
        setFile(file);
        
        const existCount = transformed.filter(r => r.exists).length;
        const changeCount = transformed.filter(r => r.hasChange).length;
        toast.success(`${transformed.length} lignes. ${existCount} produits trouvés. ${changeCount} à modifier.`);
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
    const validUpdates = preview.filter(r => r.exists && r.hasChange && r.newPuissance !== null);
    
    if (validUpdates.length === 0) {
      toast.error("Aucune modification à appliquer");
      return;
    }

    setIsProcessing(true);
    
    try {
      const updates = validUpdates.map(r => ({
        sku: r.sku,
        puissance: r.newPuissance
      }));

      const result = await apiService.bulkUpdatePuissance(updates);
      
      setResults(result);
      await refreshProducts();
      
      toast.success(`${result.updated} produits mis à jour!`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur mise à jour");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPreview([]);
    setFile(null);
    setResults(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-serif font-bold text-primary flex items-center gap-2">
          <Flame className="text-orange-500" />
          Mise à Jour de la Puissance (Excel)
        </h2>
        <p className="text-muted-foreground mt-1">Importez un fichier Excel avec les colonnes SKU et Puissance (1-5)</p>
      </div>

      <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-orange-900 mb-2">Format attendu:</h3>
        <div className="text-sm text-orange-800 space-y-1">
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><code className="bg-orange-100 px-1 rounded">SKU</code> - Identifiant du produit</li>
            <li><code className="bg-orange-100 px-1 rounded">Puissance</code> - Valeur de 1 à 5</li>
          </ul>
          <div className="mt-3 p-2 bg-white rounded border border-orange-200">
            <p className="font-semibold text-xs mb-1">Échelle de puissance :</p>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <span>1 = Léger</span>
              <span>2 = Léger-Moyen</span>
              <span>3 = Moyen</span>
              <span>4 = Medium-Full</span>
              <span>5 = Corsé</span>
            </div>
          </div>
        </div>
      </div>

      {results ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="text-green-600" size={32} />
              <div>
                <h3 className="text-lg font-semibold text-green-800">Mise à jour terminée!</h3>
                <p className="text-green-700">{results.updated} produits mis à jour</p>
              </div>
            </div>
            
            {results.notFound?.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {results.notFound.length} SKU non trouvés:
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
            isDragActive ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-orange-500'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Déposez le fichier ici...' : 'Glissez votre fichier Excel ici'}
          </p>
          <p className="text-sm text-gray-500 mt-2">ou cliquez pour sélectionner</p>
          <p className="text-xs text-gray-400 mt-4">Formats acceptés: .xlsx, .xls, .csv</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-orange-600" size={24} />
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
                    <th className="px-3 py-2 text-center">Puissance actuelle</th>
                    <th className="px-3 py-2 text-center">→</th>
                    <th className="px-3 py-2 text-center">Nouvelle puissance</th>
                    <th className="px-3 py-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-t ${
                        !row.exists ? 'bg-red-50' : 
                        row.hasChange ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-3 py-2">
                        {row.exists ? `${row.currentProduct?.marque} ${row.currentProduct?.ligne || ''}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PuissanceDisplay value={row.currentPuissance} />
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400">→</td>
                      <td className="px-3 py-2 text-center">
                        <PuissanceDisplay value={row.newPuissance} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!row.exists ? (
                          <span className="text-red-600 flex items-center justify-center gap-1">
                            <XCircle size={14} /> Non trouvé
                          </span>
                        ) : row.newPuissance === null ? (
                          <span className="text-gray-400 flex items-center justify-center gap-1">
                            - Ignoré
                          </span>
                        ) : row.hasChange ? (
                          <span className="text-green-600 flex items-center justify-center gap-1">
                            <CheckCircle size={14} /> À modifier
                          </span>
                        ) : (
                          <span className="text-gray-500 flex items-center justify-center gap-1">
                            = Identique
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
              disabled={isProcessing || preview.filter(r => r.hasChange).length === 0}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {isProcessing ? 'Mise à jour...' : `Confirmer (${preview.filter(r => r.hasChange).length} modifications)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePuissanceExcel;
