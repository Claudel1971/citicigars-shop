import { catalogueData } from "../client/src/data/catalogueData.js";
import { bundlesData } from "../client/src/data/bundles.js";

const expectedDatabaseArg = process.argv.find((arg) => arg.startsWith("--expected-database="));
if (!expectedDatabaseArg) {
  throw new Error("--expected-database est requis");
}

const expectedDatabase = expectedDatabaseArg.slice("--expected-database=".length);
if (!/^[a-zA-Z0-9_]+$/.test(expectedDatabase)) {
  throw new Error("Nom de base invalide");
}

const sqlString = (value) => `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
const suspicious = (column) => {
  const utf8Column = `CONVERT(${column} USING utf8mb4) COLLATE utf8mb4_general_ci`;
  return `(${utf8Column} LIKE '%??%' OR ${utf8Column} LIKE '%�%' OR ${utf8Column} REGEXP 'Ã|Â')`;
};
const statements = [
  "SET NAMES utf8mb4",
  "START TRANSACTION",
];

const addProductRepair = (sku, column, value, proof) => {
  if (value == null || value === "") return;
  statements.push(
    `UPDATE products SET ${column}=${sqlString(value)} WHERE sku=${sqlString(sku)} AND ${suspicious(column)} /* preuve: ${proof} */`,
  );
};

for (const source of catalogueData) {
  addProductRepair(source.sku, "marque", source.marque, "catalogueData.marque");
  addProductRepair(source.sku, "ligne", source.ligne, "catalogueData.ligne");
  addProductRepair(source.sku, "vitole", source.modele, "catalogueData.modele");
  addProductRepair(source.sku, "dimensions", source.format, "catalogueData.format");
  addProductRepair(source.sku, "dimensions_mm", source.dimensions, "catalogueData.dimensions");

  const sourceLength = source.format?.split("×", 1)[0]?.trim();
  addProductRepair(source.sku, "longueur", sourceLength, "catalogueData.format");
}

// Cas client explicitement confirmé pendant le QA.
statements.push(
  "UPDATE products SET pays='République Dominicaine' WHERE pays='R??publique Dominicaine'",
);

// Les cinq références Oliva historiques ne sont pas dans catalogueData, mais
// leur ligne saine est prouvée par CTGBDL001 dans bundles.js.
const samplerLines = new Map([
  ["CTGNI0038", "Serie V"],
  ["CTGNI0039", "Serie O"],
  ["CTGNI0040", "Serie O Maduro"],
  ["CTGNI0041", "Serie G"],
  ["CTGNI0042", "Serie G Maduro"],
]);
for (const [sku, ligne] of samplerLines) {
  addProductRepair(sku, "ligne", ligne, "bundlesData.CTGBDL001.composition");
  statements.push(
    `UPDATE bundle_items SET modele=${sqlString(ligne)} WHERE product_sku=${sqlString(sku)} AND ${suspicious("modele")} /* preuve: bundlesData.CTGBDL001.composition */`,
  );
}

// Les descriptions 001/002 sont identiques dans la source client et les
// traductions françaises versionnées. Les autres descriptions divergent entre
// sources et restent volontairement ouvertes.
for (const sku of ["CTGBDL001", "CTGBDL002"]) {
  const source = bundlesData.find((bundle) => bundle.sku === sku);
  if (source?.description) {
    statements.push(
      `UPDATE bundles SET description=${sqlString(source.description)} WHERE sku=${sqlString(sku)} AND ${suspicious("description")} /* preuve: bundlesData + locales/fr.json */`,
    );
  }
}

// CTGBDL004 a une composition saine, complète et versionnée. Le tableau est
// remplacé uniquement si la composition existante est corrompue; aucune ligne
// n'est créée dans bundle_items et CTGBDL001 n'est jamais touché ici.
const clean660Bundle = bundlesData.find((bundle) => bundle.sku === "CTGBDL004");
if (clean660Bundle?.composition) {
  statements.push(
    `UPDATE products SET composition=${sqlString(JSON.stringify(clean660Bundle.composition))} WHERE sku='CTGBDL004' AND ${suspicious("CAST(composition AS CHAR)")} /* preuve: bundlesData.CTGBDL004.composition */`,
  );
}

// Marque prouvée à la fois par le catalogue client et la source bundle jointe.
statements.push(
  "UPDATE bundle_items SET marque='Bolívar' WHERE marque='Bol??var'",
  "COMMIT",
);

process.stdout.write([
  `-- Base attendue: ${expectedDatabase}`,
  "-- Réparation idempotente: seules les valeurs encore corrompues sont modifiées.",
  ...statements.map((statement) => `${statement};`),
  "",
].join("\n"));
