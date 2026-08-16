// Preuve du point 4 (audit) : stock_movements doit REJETER tout UPDATE et
// tout DELETE d'une ligne existante, par exécution réelle contre l'instance
// MariaDB locale jetable (jamais une vraie DB).
import mysql from "mysql2/promise";
const db = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: "citicigars_rehearsal" });

// Insère un mouvement réel pour avoir une ligne à tenter de modifier/supprimer.
// stock_movements exige un sku existant (FK posée en 0004) : on réutilise le
// sku factice déjà backfillé par le rehearsal précédent.
const [[skuRow]] = await db.query("SELECT sku FROM skus LIMIT 1");
if (!skuRow) throw new Error("Aucun sku disponible dans la DB de répétition — lancer d'abord rehearsal-baseline-and-migrate.mjs + drizzle-kit migrate");

await db.query(
  `INSERT INTO stock_movements
    (group_id, sku, type, pack_size, balance_field, movement_type, qty_delta, qty_before, qty_after, author, created_at)
   VALUES (?, ?, 'Box', 0, 'onHand', 'RECEPTION', 5, 0, 5, 'rehearsal-script', NOW())`,
  ["rehearsal-immutability-test", skuRow.sku],
);
const [[row]] = await db.query("SELECT id, qty_delta FROM stock_movements WHERE sku=? ORDER BY id DESC LIMIT 1", [skuRow.sku]);
console.log("Ligne stock_movements insérée pour le test:", row);

let updateRejected = false;
try {
  await db.query("UPDATE stock_movements SET qty_delta = 999 WHERE id = ?", [row.id]);
  console.error("ECHEC DE LA PREUVE : l'UPDATE aurait dû être rejeté");
} catch (e) {
  updateRejected = true;
  console.log("OK : UPDATE rejeté comme attendu :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

let deleteRejected = false;
try {
  await db.query("DELETE FROM stock_movements WHERE id = ?", [row.id]);
  console.error("ECHEC DE LA PREUVE : le DELETE aurait dû être rejeté");
} catch (e) {
  deleteRejected = true;
  console.log("OK : DELETE rejeté comme attendu :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

const [[stillThere]] = await db.query("SELECT id, qty_delta FROM stock_movements WHERE id = ?", [row.id]);
console.log("Ligne toujours intacte après les deux tentatives (qty_delta doit rester 5, pas 999):", stillThere);

await db.end();
process.exitCode = updateRejected && deleteRejected && stillThere && stillThere.qty_delta === 5 ? 0 : 1;
