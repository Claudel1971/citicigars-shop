import React, { useState } from "react";
import { useProducts } from "@/context/ProductContext";
import { Upload, AlertCircle, CheckCircle, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export default function UpdatePrices() {
  const { products, updateProduct } = useProducts();
  const [previewData, setPreviewData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState({
    success: 0,
    errors: 0,
    details: [],
  });

  // Lecture du fichier Excel
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Normaliser les colonnes (insensible à la casse et aux espaces)
      const normalized = jsonData.map((row) => {
        const normalizedRow = {};
        Object.keys(row).forEach((key) => {
          const normalizedKey = key.toLowerCase().trim();
          normalizedRow[normalizedKey] = row[key];
        });

        return {
          sku:
            normalizedRow.sku ||
            normalizedRow.référence ||
            normalizedRow.reference ||
            "",
          prixUnitaire: parseFloat(
            normalizedRow["prix unitaire"] ||
              normalizedRow.prixunitaire ||
              normalizedRow["prix unité"] ||
              0,
          ),
          prixPack: parseFloat(
            normalizedRow["prix pack"] || normalizedRow.prixpack || 0,
          ),
          prixBoite: parseFloat(
            normalizedRow["prix boite"] ||
              normalizedRow["prix boîte"] ||
              normalizedRow.prixboite ||
              0,
          ),
          rabaisUnitaire: parseFloat(
            normalizedRow["rabais unitaire"] ||
              normalizedRow.rabaisunitaire ||
              normalizedRow["rabais unité"] ||
              0,
          ),
          rabaisPack: parseFloat(
            normalizedRow["rabais pack"] || normalizedRow.rabaispack || 0,
          ),
          rabaisBoite: parseFloat(
            normalizedRow["rabais boite"] ||
              normalizedRow["rabais boîte"] ||
              normalizedRow.rabaisboite ||
              0,
          ),
        };
      });

      // Valider les données
      const validated = normalized.map((row) => {
        const product = products.find((p) => p.sku === row.sku);
        return {
          ...row,
          exists: !!product,
          productName: product
            ? `${product.marque} ${product.ligne || product.modele || ""}`
            : "Produit introuvable",
          valid:
            !!product &&
            (row.prixUnitaire > 0 || row.prixPack > 0 || row.prixBoite > 0),
        };
      });

      setPreviewData(validated);
      toast.success(`${validated.length} lignes chargées`);
    } catch (error) {
      console.error("Erreur lecture Excel:", error);
      toast.error("Erreur lors de la lecture du fichier");
    }
  };

  // Application des mises à jour
  const applyUpdates = async () => {
    setIsProcessing(true);
    const successList = [];
    const errorList = [];

    for (const row of previewData) {
      if (!row.valid) {
        errorList.push({
          sku: row.sku,
          reason: "Données invalides ou produit introuvable",
        });
        continue;
      }

      try {
        const product = products.find((p) => p.sku === row.sku);
        const updatedProduct = { ...product };

        // Mise à jour des prix
        if (row.prixUnitaire > 0)
          updatedProduct.prixUnitaire = row.prixUnitaire;
        if (row.prixPack > 0) updatedProduct.prixPack = row.prixPack;
        if (row.prixBoite > 0) updatedProduct.prixBoite = row.prixBoite;

        // Mise à jour des promotions
        if (!updatedProduct.promotions) {
          updatedProduct.promotions = {
            unitaire: { actif: false, pourcentage: 0 },
            pack: { actif: false, pourcentage: 0 },
            boite: { actif: false, pourcentage: 0 },
          };
        }

        const arrondir500 = (val) => Math.round(val / 500) * 500;

        if (row.rabaisUnitaire > 0) {
          updatedProduct.promotions.unitaire.actif = true;
          updatedProduct.promotions.unitaire.pourcentage = row.rabaisUnitaire;
          updatedProduct.promotions.unitaire.prixPromo = arrondir500(updatedProduct.prixUnitaire * (1 - row.rabaisUnitaire / 100));
        } else {
          updatedProduct.promotions.unitaire.actif = false;
          updatedProduct.promotions.unitaire.pourcentage = 0;
          updatedProduct.promotions.unitaire.prixPromo = null;
        }

        if (row.rabaisPack > 0) {
          updatedProduct.promotions.pack.actif = true;
          updatedProduct.promotions.pack.pourcentage = row.rabaisPack;
          updatedProduct.promotions.pack.prixPromo = arrondir500(updatedProduct.prixPack * (1 - row.rabaisPack / 100));
        } else {
          updatedProduct.promotions.pack.actif = false;
          updatedProduct.promotions.pack.pourcentage = 0;
          updatedProduct.promotions.pack.prixPromo = null;
        }

        if (row.rabaisBoite > 0) {
          updatedProduct.promotions.boite.actif = true;
          updatedProduct.promotions.boite.pourcentage = row.rabaisBoite;
          updatedProduct.promotions.boite.prixPromo = arrondir500(updatedProduct.prixBoite * (1 - row.rabaisBoite / 100));
        } else {
          updatedProduct.promotions.boite.actif = false;
          updatedProduct.promotions.boite.pourcentage = 0;
          updatedProduct.promotions.boite.prixPromo = null;
        }

        await updateProduct(updatedProduct);
        successList.push({ sku: row.sku, name: row.productName });
      } catch (error) {
        console.error(`Erreur mise à jour ${row.sku}:`, error);
        errorList.push({ sku: row.sku, reason: error.message });
      }
    }

    setResults({
      success: successList.length,
      errors: errorList.length,
      details: { successList, errorList },
    });

    setIsProcessing(false);

    if (errorList.length === 0) {
      toast.success(
        `✅ ${successList.length} produits mis à jour avec succès !`,
      );
      setPreviewData([]);
    } else {
      toast.warning(
        `⚠️ ${successList.length} réussis, ${errorList.length} erreurs`,
      );
    }
  };

  // Télécharger le template Excel
  const downloadTemplate = () => {
    const template = [
      {
        SKU: "CTGRD0001",
        "Prix Unitaire": 15000,
        "Prix Pack": 75000,
        "Prix Boite": 300000,
        "Rabais Unitaire": 0,
        "Rabais Pack": 10,
        "Rabais Boite": 15,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_prix_citicigars.xlsx");
    toast.success("Template téléchargé !");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-serif font-bold text-primary">
          Mise à Jour des Prix en Masse
        </h1>
        <button
          onClick={downloadTemplate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          📥 Télécharger Template Excel
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-blue-900 mb-2">📋 Instructions :</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Téléchargez le template Excel ci-dessus</li>
          <li>
            Remplissez les colonnes : SKU, Prix Unitaire, Prix Pack, Prix Boite
          </li>
          <li>Optionnel : Rabais Unitaire, Rabais Pack, Rabais Boite (en %)</li>
          <li>Uploadez le fichier rempli pour prévisualiser</li>
          <li>Validez pour appliquer les changements</li>
        </ul>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
        <Upload size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Glissez votre fichier Excel ou cliquez pour sélectionner
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Formats acceptés : .xlsx, .xls
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="excelInput"
        />
        <label
          htmlFor="excelInput"
          className="px-6 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90 transition-colors inline-block"
        >
          Sélectionner un fichier
        </label>
      </div>

      {previewData.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">
              Aperçu des mises à jour ({previewData.length} lignes)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewData([])}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={applyUpdates}
                disabled={
                  isProcessing ||
                  previewData.filter((d) => d.valid).length === 0
                }
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Appliquer les mises à jour
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">
                    Statut
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700">
                    Produit
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">
                    Prix Unit.
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">
                    Prix Pack
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">
                    Prix Boîte
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">
                    Rabais Unit.
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">
                    Rabais Pack
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-gray-700">
                    Rabais Boîte
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-b ${row.valid ? "bg-white" : "bg-red-50"}`}
                  >
                    <td className="px-4 py-2">
                      {row.valid ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <AlertCircle size={16} className="text-red-600" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono">{row.sku}</td>
                    <td className="px-4 py-2 text-sm">{row.productName}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {row.prixUnitaire > 0
                        ? `${row.prixUnitaire.toLocaleString()} F`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {row.prixPack > 0
                        ? `${row.prixPack.toLocaleString()} F`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {row.prixBoite > 0
                        ? `${row.prixBoite.toLocaleString()} F`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {row.rabaisUnitaire > 0 ? `${row.rabaisUnitaire}%` : "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {row.rabaisPack > 0 ? `${row.rabaisPack}%` : "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {row.rabaisBoite > 0 ? `${row.rabaisBoite}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.success > 0 && (
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Résultats de la mise à jour
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={20} className="text-green-600" />
                <span className="font-bold text-green-800">Succès</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {results.success}
              </p>
            </div>

            {results.errors > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={20} className="text-red-600" />
                  <span className="font-bold text-red-800">Erreurs</span>
                </div>
                <p className="text-3xl font-bold text-red-600">
                  {results.errors}
                </p>
              </div>
            )}
          </div>

          {results.details.errorList &&
            results.details.errorList.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-bold text-red-800 mb-2">
                  Détails des erreurs :
                </h3>
                <ul className="space-y-1">
                  {results.details.errorList.map((error, idx) => (
                    <li key={idx} className="text-sm text-red-700">
                      • {error.sku}: {error.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
