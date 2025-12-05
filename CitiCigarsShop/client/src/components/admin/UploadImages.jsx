import React, { useState } from "react";
import { Upload, X, Check, AlertCircle } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { useProducts } from "@/context/ProductContext";

function detecterTypeImage(nomFichier) {
  const nom = nomFichier.toLowerCase();

  if (
    nom.includes("open box") ||
    nom.includes("open_box") ||
    nom.includes("boite ouverte") ||
    nom.includes("boite_ouverte")
  ) {
    return "principale";
  }

  if (nom.includes("solo")) {
    return "solo";
  }

  // 🆕 Détection Pack (4) vs Pack (5)
  if (
    nom.includes("pack4") ||
    nom.includes("pack_4") ||
    nom.includes("4pack")
  ) {
    return "pack4";
  }
  if (
    nom.includes("pack5") ||
    nom.includes("pack_5") ||
    nom.includes("5pack")
  ) {
    return "pack5";
  }
  if (nom.includes("pack") || nom.includes("bundle")) {
    return "pack"; // Fallback générique
  }

  if (
    nom.includes("closed") ||
    nom.includes("closed box") ||
    nom.includes("closed_box") ||
    nom.includes("boite ferme") ||
    nom.includes("boite fermée") ||
    nom.includes("boite_ferme")
  ) {
    return "boite";
  }

  return "principale";
}

function extraireSKU(nomFichier) {
  const nom = nomFichier.toUpperCase();
  const parts = nom.split("_");
  if (parts.length > 0 && parts[0].startsWith("CTG")) {
    return parts[0];
  }
  return "";
}

const compressImage = (file, maxWidth = 1200, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const originalSize = file.size / 1024;
              const compressedSize = blob.size / 1024;
              const reduction = ((1 - blob.size / file.size) * 100).toFixed(1);

              console.log(
                `📦 Compression: ${originalSize.toFixed(
                  1,
                )}KB → ${compressedSize.toFixed(1)}KB (-${reduction}%)`,
              );
              resolve(blob);
            } else {
              reject(new Error("Compression failed"));
            }
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const UploadImages = () => {
  const productContext = useProducts();
  if (!productContext) {
    console.warn("UploadImages est utilisé hors de ProductProvider");
    return <div>Chargement des produits...</div>;
  }

  const { products = [], updateProductImages } = productContext;
  const [imagesUploadees, setImagesUploadees] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const verifierProduit = (sku) => {
    return products.some((p) => p.sku === sku);
  };

  const updateSKU = (index, newSku) => {
    const updated = [...imagesUploadees];
    updated[index].sku = newSku;
    updated[index].valide = verifierProduit(newSku);
    setImagesUploadees(updated);
  };

  const handleFileUpload = async (files) => {
    setIsProcessing(true);
    setCurrentStep("Analyse et compression des fichiers...");
    setProgress(0);

    const processedImages = [];
    const filesArray = Array.from(files);
    const totalFiles = filesArray.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesArray[i];

      if (file.name.endsWith(".zip")) {
        setCurrentStep(`Extraction et compression de ${file.name}...`);
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.keys(zip.files);

          for (const filename of entries) {
            if (
              !zip.files[filename].dir &&
              !filename.startsWith("__MACOSX") &&
              filename.match(/\.(jpg|jpeg|png|webp)$/i)
            ) {
              const blob = await zip.files[filename].async("blob");
              const cleanName = filename.split("/").pop();

              const originalFile = new File([blob], cleanName, {
                type: blob.type,
              });
              const compressedBlob = await compressImage(originalFile);
              const compressedFile = new File(
                [compressedBlob],
                cleanName.replace(/\.(png|webp)$/i, ".jpg"),
                { type: "image/jpeg" },
              );

              const typeDetecte = detecterTypeImage(cleanName);

              processedImages.push({
                file: compressedFile,
                preview: URL.createObjectURL(compressedBlob),
                nom: cleanName,
                sku: extraireSKU(cleanName),
                type: typeDetecte,
                valide: false,
              });
            }
          }
        } catch (err) {
          console.error(err);
          toast.error(`Erreur extraction ${file.name}`);
        }
      } else if (file.type.startsWith("image/")) {
        setCurrentStep(`Compression de ${file.name}...`);

        try {
          const compressedBlob = await compressImage(file);
          const compressedFile = new File(
            [compressedBlob],
            file.name.replace(/\.(png|webp)$/i, ".jpg"),
            { type: "image/jpeg" },
          );

          const typeDetecte = detecterTypeImage(file.name);
          processedImages.push({
            file: compressedFile,
            preview: URL.createObjectURL(compressedBlob),
            nom: file.name,
            sku: extraireSKU(file.name),
            type: typeDetecte,
            valide: false,
          });
        } catch (err) {
          console.error("Erreur compression:", err);
          toast.error(`Erreur compression ${file.name}`);
        }
      }

      setProgress(Math.round(((i + 1) / totalFiles) * 100));
    }

    const imagesFinales = processedImages.map((img) => ({
      ...img,
      valide: verifierProduit(img.sku),
    }));

    setImagesUploadees((prev) => [...prev, ...imagesFinales]);
    setIsProcessing(false);
    toast.success(`${imagesFinales.length} images compressées et prêtes`);
  };

  const validerAssociations = () => {
    const erreurs = [];
    const parSKU = {};

    imagesUploadees.forEach((img) => {
      if (!img.valide) return;
      if (!parSKU[img.sku]) {
        parSKU[img.sku] = [];
      }
      parSKU[img.sku].push(img);
    });

    Object.entries(parSKU).forEach(([sku, images]) => {
      const principales = images.filter((img) => img.type === "principale");
      if (principales.length > 1) {
        erreurs.push(
          `❌ ${sku}: ${principales.length} images "Principale". Il ne doit y en avoir qu'UNE.`,
        );
      }
    });

    if (erreurs.length > 0) {
      alert(
        `⚠️ ERREURS DE VALIDATION:\n\n${erreurs.join(
          "\n",
        )}\n\nCorrigez avant de valider.`,
      );
      return false;
    }

    return true;
  };

  const validerTout = async () => {
    if (!validerAssociations()) return;

    const valides = imagesUploadees.filter((img) => img.valide);
    if (valides.length === 0) return;

    setIsProcessing(true);
    setCurrentStep("Sauvegarde des associations...");
    setProgress(0);

    const bySku = {};

    for (let i = 0; i < valides.length; i++) {
      const img = valides[i];
      const reader = new FileReader();

      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const b64 = reader.result;

          if (!bySku[img.sku]) bySku[img.sku] = [];

          bySku[img.sku].push({
            type: img.type,
            data: b64,
          });

          console.log(`✅ Image sauvegardée pour ${img.sku}: ${img.type}`);
          resolve();
        };
        reader.onerror = () => {
          console.error("Erreur lecture fichier");
          reject(reader.error);
        };
        reader.readAsDataURL(img.file);
      });

      setProgress(Math.round(((i + 1) / valides.length) * 100));
    }

    let successCount = 0;
    let failedSkus = [];
    const skuEntries = Object.entries(bySku);
    const totalSkus = skuEntries.length;
    
    setCurrentStep("Envoi des images au serveur...");
    
    for (let i = 0; i < skuEntries.length; i++) {
      const [sku, images] = skuEntries[i];
      setCurrentStep(`Envoi ${i + 1}/${totalSkus}: ${sku}...`);
      
      let success = false;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        attempts++;
        try {
          const result = await updateProductImages(sku, images);
          if (result && result.success) {
            success = true;
            successCount++;
          } else {
            console.log(`⚠️ Tentative ${attempts}/${maxAttempts} échouée pour ${sku}`);
            if (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        } catch (err) {
          console.error(`❌ Erreur tentative ${attempts}/${maxAttempts} pour ${sku}:`, err);
          if (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      
      if (!success) {
        failedSkus.push(sku);
      }
      
      if (i < skuEntries.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
      
      setProgress(Math.round(((i + 1) / totalSkus) * 100));
    }

    setIsProcessing(false);

    if (failedSkus.length > 0) {
      toast.error(`❌ Échec pour ${failedSkus.length} produit(s): ${failedSkus.join(', ')}`);
    }
    
    if (successCount > 0) {
      toast.success(`✅ ${successCount} produit(s) mis à jour avec succès!`);
      setImagesUploadees((prev) => prev.filter((img) => !img.valide || failedSkus.includes(img.sku)));

      setTimeout(() => {
        if (
          confirm(
            "Associations sauvegardées ! Aller au catalogue pour voir le résultat ?",
          )
        ) {
          window.location.href = "/catalogue";
        }
      }, 500);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-serif font-bold text-primary">
        Gestion des Images
      </h1>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg shadow-sm">
        <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          💡 Convention de nommage + Compression automatique
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <div>
            <p className="font-semibold mb-1">Format fichier:</p>
            <code className="bg-blue-100 px-2 py-1 rounded block w-fit">
              SKU_type.jpg
            </code>
            <p className="mt-1 text-xs opacity-80">
              Ex: CTGNI0022_pack4_1.jpg ou CTGNI0022_pack5_2.jpg
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">🆕 Pack (4) vs Pack (5):</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Utilisez "pack4" dans le nom pour Pack (4)</li>
              <li>Utilisez "pack5" dans le nom pour Pack (5)</li>
              <li>Ou choisissez manuellement dans le dropdown</li>
            </ul>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border border-gray-200">
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progression
                </span>
                <span className="text-sm font-medium text-amber-600">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-amber-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-center text-gray-700 font-medium">
              {currentStep}
            </p>
            <p className="text-xs text-center text-gray-500 mt-2 animate-pulse">
              Compression et traitement en cours...
            </p>
          </div>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-amber-500 bg-amber-50 scale-[1.02]"
            : "border-gray-300 hover:border-amber-500 hover:bg-gray-50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById("fileInput").click()}
      >
        <Upload
          size={48}
          className={`mx-auto mb-4 transition-colors ${
            isDragging ? "text-amber-600" : "text-gray-400"
          }`}
        />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Glissez vos images ou fichier ZIP
        </p>
        <p className="text-sm text-gray-500">
          JPG, PNG, WEBP acceptés • Compression automatique
        </p>
        <input
          id="fileInput"
          type="file"
          multiple
          accept="image/*,.zip"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {imagesUploadees.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-border overflow-hidden">
          <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              Images à traiter
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                {imagesUploadees.length}
              </span>
            </h2>
            <div className="text-sm text-gray-500">
              {imagesUploadees.filter((i) => i.valide).length} prêtes à valider
            </div>
          </div>

          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto bg-gray-50/50">
            {imagesUploadees.map((img, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 p-4 border rounded-lg bg-white transition-all ${
                  img.valide
                    ? "border-green-200 shadow-sm"
                    : "border-orange-200"
                }`}
              >
                <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                  <img
                    src={img.preview}
                    alt={img.nom}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <p
                      className="font-mono text-xs text-gray-500 truncate max-w-[300px]"
                      title={img.nom}
                    >
                      {img.nom}
                    </p>
                    <button
                      onClick={() =>
                        setImagesUploadees(
                          imagesUploadees.filter((_, i) => i !== index),
                        )
                      }
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        SKU Produit
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={img.sku}
                          onChange={(e) =>
                            updateSKU(index, e.target.value.toUpperCase())
                          }
                          placeholder="Ex: CTGNI0022"
                          className={`w-full pl-3 pr-8 py-2 border rounded text-sm font-mono ${
                            img.valide
                              ? "border-green-500 bg-green-50 text-green-800"
                              : "border-orange-300 focus:border-orange-500"
                          }`}
                        />
                        {img.valide && (
                          <Check
                            size={14}
                            className="absolute right-3 top-2.5 text-green-600"
                          />
                        )}
                      </div>
                      {!img.valide && img.sku && (
                        <p className="text-[10px] text-red-500 mt-1">
                          SKU non trouvé dans la base
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Type d'image
                      </label>
                      <select
                        value={img.type}
                        onChange={(e) => {
                          const updated = [...imagesUploadees];
                          updated[index].type = e.target.value;
                          setImagesUploadees(updated);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                      >
                        <option value="principale">Principale (Défaut)</option>
                        <option value="solo">Solo (Cigare)</option>
                        <option value="pack4">Pack (4)</option>
                        <option value="pack5">Pack (5)</option>
                        <option value="boite">Boîte</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {img.valide ? (
                      <span className="text-green-600 text-xs font-bold flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-100">
                        <Check size={12} /> Prêt à associer
                      </span>
                    ) : (
                      <span className="text-orange-600 text-xs font-bold flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                        <AlertCircle size={12} /> SKU requis ou invalide
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-white border-t flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setImagesUploadees([])}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Tout annuler
            </button>
            <button
              onClick={validerTout}
              disabled={
                imagesUploadees.filter((img) => img.valide).length === 0
              }
              className="flex-1 bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md flex justify-center items-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Valider {imagesUploadees.filter((i) => i.valide).length}{" "}
              association(s)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckCircleIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

export default UploadImages;
