import React from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useProducts } from '@/context/ProductContext';
import { toast } from 'sonner';
import { determinerTypePack } from '@/utils/priceCalculator';
import Button from '../shared/Button';
import { UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';

const ImportExcel = () => {
  const { importProducts } = useProducts();
  const [preview, setPreview] = React.useState([]);
  const [file, setFile] = React.useState(null);

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
        
        // Basic Validation & Transformation
        const transformed = json.map(row => ({
          sku: row.SKU || `GEN-${Math.random().toString(36).substr(2, 5)}`,
          marque: row.Marque || "Inconnue",
          modele: row.Modele || "Standard",
          format: row.Format || "N/A",
          typePack: determinerTypePack(row.Format),
          prixUnitaire: parseFloat(row.Prix_Unit) || 0,
          prixPack: parseFloat(row.Prix_Pack4) || parseFloat(row.Prix_Pack5) || 0,
          prixBoite: parseFloat(row.Prix_Boite) || 0,
          qteBoite: parseInt(row.Qte_Boite) || 20,
          origine: row.Origine || "Autre",
          force: row.Force || "Moyenne",
          image: null,
          description: row.Description || "Description à venir.",
          featured: false,
          promotions: {
            unitaire: { actif: false, pourcentage: 0 },
            pack: { actif: false, pourcentage: 0 },
            boite: { actif: false, pourcentage: 0 }
          }
        }));

        setPreview(transformed);
        toast.success(`${transformed.length} produits analysés.`);
      } catch (error) {
        toast.error("Erreur lors de la lecture du fichier Excel.");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } 
  });

  const handleConfirm = () => {
    if (preview.length > 0) {
      importProducts(preview);
      toast.success("Catalogue mis à jour avec succès !");
      setPreview([]);
      setFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif font-bold">Importer des Produits (Excel)</h2>

      {!file ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'border-secondary bg-secondary/10' : 'border-border hover:border-primary'}`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-primary">Glissez votre fichier Excel ici</p>
          <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
          <div className="mt-4 text-xs text-muted-foreground bg-muted p-2 rounded">
            Format attendu: SKU, Marque, Modele, Format, Prix_Unit...
          </div>
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
            <button onClick={() => setFile(null)} className="text-sm text-destructive hover:underline">Changer</button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Marque</th>
                  <th className="p-3">Modèle</th>
                  <th className="p-3">Prix Unit</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3 font-mono">{row.sku}</td>
                    <td className="p-3">{row.marque}</td>
                    <td className="p-3">{row.modele}</td>
                    <td className="p-3">{row.prixUnitaire}</td>
                    <td className="p-3 text-green-600"><CheckCircle size={14} /> OK</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && (
              <div className="p-2 text-center text-xs text-muted-foreground bg-muted/10">
                ...et {preview.length - 5} autres lignes
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => { setFile(null); setPreview([]); }}>Annuler</Button>
            <Button onClick={handleConfirm} className="gap-2"><CheckCircle size={16} /> Confirmer l'import</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcel;
