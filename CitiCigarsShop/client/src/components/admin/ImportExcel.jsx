import React from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useProducts } from '@/context/ProductContext';
import { toast } from 'sonner';
import Button from '../shared/Button';
import { UploadCloud, FileSpreadsheet, CheckCircle } from 'lucide-react';

const ImportExcel = () => {
  const { importProducts } = useProducts();
  const [preview, setPreview] = React.useState([]);
  const [file, setFile] = React.useState(null);
  const [rawColumns, setRawColumns] = React.useState([]);
  const [rawFirstRow, setRawFirstRow] = React.useState(null);
  const [debugProduct, setDebugProduct] = React.useState(null);

  const normaliserRabais = (rabais) => {
    if (!rabais || rabais === 0) return 0;
    return Math.abs(parseFloat(rabais));
  };

  const mapExcelRowToProduct = (row) => {
    const rabais = normaliserRabais(row['Rabais (%)'] || row['Rabais'] || row['rabais'] || row['Rabais(%)'] || 0);
    const prixUnitaire = parseInt(row['Prix unitaire'] || row['prix unitaire'] || row['Prix Unitaire'] || row['p. u.'] || row['p.u.'] || row['p. u'] || row['pu'] || row['P. U.'] || row['P.U.'] || row['Prix_Unit'] || row['Prix Unit'] || row['prixUnitaire'] || 0);
    const qtyPack = parseInt(row['Qte / pack'] || row['Qte/pack'] || row['Qte_Pack'] || row['typePack'] || row['Qté/pack'] || 4);
    const qtyBoite = parseInt(row['Qté/boîte'] || row['Qté / boîte'] || row['Qte_Boite'] || row['qteBoite'] || row['Qte/boite'] || 25);

    const prixPack = parseInt(row['Prix_Pack'] || row['prixPack'] || 0) || (prixUnitaire * qtyPack);
    const prixBoite = parseInt(row['Prix_Boite'] || row['prixBoite'] || 0) || (prixUnitaire * qtyBoite);

    const ratingValue = row['Note'] || row['rating'] || null;
    const hasValidRating = ratingValue && ratingValue !== 'NA' && ratingValue !== 'N/A';

    return {
      sku: row['SKU'] || row['sku'],
      marque: row['Marque'] || row['marque'],
      ligne: row['Ligne / Série'] || row['Ligne/Série'] || row['Ligne'] || row['Serie'] || row['Série'] || row['ligne'] || null,
      pays: row['Pays'] || row['pays'] || row['Origine'] || row['origine'] || null,
      modele: row['Modèle'] || row['Modele'] || row['modele'] || row['modèle'] || null,
      
      vitole: row['Vitole'] || row['vitole'] || null,
      format: row['Format'] || row['format'] || null,
      dimensions: row['Dimensions (pouces)'] || row['Dimensions'] || row['dimensions'] || null,
      dimensionsMM: row['Dimensions (mm)'] || row['dimensionsMM'] || null,
      longueur: row['Lenght'] || row['Length'] || row['longueur'] || null,
      ringGauge: parseInt(row['Ring'] || row['ringGauge'] || 0) || null,
      
      qteBoite: qtyBoite,
      quantiteBoite: qtyBoite,
      typePack: qtyPack,
      quantitePack: qtyPack,
      
      puissance: parseInt(row['Puissance'] || row['puissance'] || 0) || null,
      rating: hasValidRating ? String(ratingValue) : null,
      top25: row['Top25'] === 'Oui' || row['Top25'] === 'OUI' || row['Top25'] === true || row['top25'] === true,
      rank: parseInt(row['Rang'] || row['rank'] || 0) || null,
      year: parseInt(row['Année'] || row['Annee'] || row['year'] || 0) || null,
      
      badges: {
        rating: hasValidRating ? String(ratingValue) : null,
        top25: row['Top25'] === 'Oui' || row['Top25'] === 'OUI' || row['Top25'] === true,
        top25Rang: parseInt(row['Rang'] || 0) || null,
        top25Year: parseInt(row['Année'] || row['Annee'] || 0) || null
      },
      
      prixUnitaire: prixUnitaire,
      prixPack: prixPack,
      prixBoite: prixBoite,
      
      promotions: {
        unitaire: {
          actif: rabais > 0,
          pourcentage: rabais,
          prixPromo: rabais > 0 ? Math.round(prixUnitaire * (1 - rabais / 100)) : null
        },
        pack: {
          actif: rabais > 0,
          pourcentage: rabais,
          prixPromo: rabais > 0 ? Math.round(prixPack * (1 - rabais / 100)) : null
        },
        boite: {
          actif: rabais > 0,
          pourcentage: rabais,
          prixPromo: rabais > 0 ? Math.round(prixBoite * (1 - rabais / 100)) : null
        }
      },
      
      inCatalogue: true,
      coupDeCoeur: false,
      origine: row['Origine'] || row['origine'] || row['Pays'] || row['pays'] || null,
      description: row['Description'] || row['description'] || null
    };
  };

  const onDrop = React.useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    setFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        const columns = Object.keys(json[0] || {});
        setRawColumns(columns);
        setRawFirstRow(json[0] || null);
        
        const transformed = json
          .filter(row => row['SKU'] || row['sku'])
          .map(mapExcelRowToProduct);

        setPreview(transformed);
        setDebugProduct(transformed[0] || null);
        toast.success(`${transformed.length} produits analysés.`);
        
        console.log('=== DEBUG IMPORT EXCEL ===');
        console.log('Colonnes Excel détectées:', columns);
        console.log('Première ligne brute:', json[0]);
        console.log('Premier produit transformé:', transformed[0]);
      } catch (error) {
        toast.error("Erreur lors de la lecture du fichier Excel.");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    } 
  });

  const handleConfirm = () => {
    if (preview.length > 0) {
      importProducts(preview);
      toast.success(`${preview.length} produits importés avec succès !`);
      setPreview([]);
      setFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif font-bold">Importer des Produits (Excel)</h2>
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <p className="font-semibold text-amber-800 mb-2">Colonnes Excel attendues :</p>
        <p className="text-amber-700">
          SKU, Marque, Ligne / Série, Pays, Vitole, Format, Dimensions (pouces), 
          Dimensions (mm), Lenght, Ring, Qté/boîte, Puissance, Note, Top25, 
          Rang, Année, p. u., Rabais (%), Qte / pack
        </p>
      </div>

      {!file ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'border-secondary bg-secondary/10' : 'border-border hover:border-primary'}`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-primary">Glissez votre fichier Excel ici</p>
          <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-muted/20 p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-green-600" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{preview.length} produits détectés</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setPreview([]); }} className="text-sm text-destructive hover:underline">Changer</button>
          </div>

          {/* DEBUG: Colonnes Excel détectées */}
          {rawColumns.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-blue-800">🔍 DEBUG - Colonnes Excel détectées ({rawColumns.length})</h3>
              <div className="flex flex-wrap gap-1">
                {rawColumns.map((col, i) => (
                  <span key={i} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                    "{col}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* DEBUG: Première ligne brute */}
          {rawFirstRow && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-purple-800">📋 DEBUG - Première ligne Excel (CTGCU0001 ou autre)</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(rawFirstRow).map(([key, value], i) => (
                  <div key={i} className="flex gap-2 bg-purple-100 p-2 rounded">
                    <span className="font-mono font-bold text-purple-700">"{key}":</span>
                    <span className="text-purple-900">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DEBUG: Produit transformé */}
          {debugProduct && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-green-800">✅ DEBUG - Produit transformé complet ({debugProduct.sku})</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(debugProduct).map(([key, value], i) => (
                  <div key={i} className="flex gap-2 bg-green-100 p-2 rounded">
                    <span className="font-mono font-bold text-green-700">{key}:</span>
                    <span className="text-green-900">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'null')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Marque</th>
                  <th className="p-3">Ligne</th>
                  <th className="p-3">Vitole</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">Ring</th>
                  <th className="p-3">Prix Unit</th>
                  <th className="p-3">Rabais</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t hover:bg-muted/10">
                    <td className="p-3 font-mono text-xs">{row.sku}</td>
                    <td className="p-3">{row.marque}</td>
                    <td className="p-3 text-xs">{row.ligne || '-'}</td>
                    <td className="p-3 text-xs">{row.vitole || '-'}</td>
                    <td className="p-3 text-xs">{row.format || '-'}</td>
                    <td className="p-3 text-xs">{row.ringGauge || '-'}</td>
                    <td className="p-3 font-semibold">{row.prixUnitaire?.toLocaleString()} FCFA</td>
                    <td className="p-3">
                      {row.promotions?.unitaire?.actif ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">
                          -{row.promotions.unitaire.pourcentage}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-green-600"><CheckCircle size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <div className="p-2 text-center text-xs text-muted-foreground bg-muted/10">
                ...et {preview.length - 10} autres produits
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => { setFile(null); setPreview([]); }}>Annuler</Button>
            <Button onClick={handleConfirm} className="gap-2">
              <CheckCircle size={16} /> Confirmer l'import ({preview.length} produits)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcel;
