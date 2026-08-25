// Preuve du point 4 (audit) : stock_movements et stock_movement_groups doivent
// REJETER tout UPDATE et tout DELETE d'une ligne existante, par exécution réelle contre l'instance
// MariaDB locale jetable (jamais une vraie DB).
import mysql from "mysql2/promise";
const db = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: "citicigars_rehearsal" });

// Insère un mouvement réel pour avoir une ligne à tenter de modifier/supprimer.
// stock_movements exige un sku existant (FK posée en 0004) : on réutilise le
// sku factice déjà backfillé par le rehearsal précédent.
const [[skuRow]] = await db.query("SELECT sku FROM skus LIMIT 1");
if (!skuRow) throw new Error("Aucun sku disponible dans la DB de répétition — lancer d'abord rehearsal-baseline-and-migrate.mjs + drizzle-kit migrate");

const groupId = "rehearsal-immutability-test";
await db.query(
  `INSERT INTO stock_movement_groups
    (group_id, movement_type, author, created_at)
   VALUES (?, 'RECEPTION', 'rehearsal-script', NOW())`,
  [groupId],
);
await db.query(
  `INSERT INTO stock_movements
    (group_id, sku, type, pack_size, balance_field, movement_type, qty_delta, qty_before, qty_after, author, created_at)
   VALUES (?, ?, 'Box', 0, 'onHand', 'RECEPTION', 5, 0, 5, 'rehearsal-script', NOW())`,
  [groupId, skuRow.sku],
);
await db.query(
  `INSERT INTO stock_movement_lot_allocations
    (group_id, lot_id, location_id, sku, type, pack_size, balance_field, qty_delta, qty_before, qty_after, created_at)
   VALUES (?, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', ?, 'Box', 0, 'onHand', 5, 0, 5, NOW())`,
  [groupId, skuRow.sku],
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

let groupUpdateRejected = false;
try {
  await db.query("UPDATE stock_movement_groups SET author = 'tampered' WHERE group_id = ?", [groupId]);
  console.error("ECHEC DE LA PREUVE : l'UPDATE du groupe aurait dû être rejeté");
} catch (e) {
  groupUpdateRejected = true;
  console.log("OK : UPDATE groupe rejeté comme attendu :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

let groupDeleteRejected = false;
try {
  await db.query("DELETE FROM stock_movement_groups WHERE group_id = ?", [groupId]);
  console.error("ECHEC DE LA PREUVE : le DELETE du groupe aurait dû être rejeté");
} catch (e) {
  groupDeleteRejected = true;
  console.log("OK : DELETE groupe rejeté comme attendu :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

const [[groupStillThere]] = await db.query("SELECT group_id, author FROM stock_movement_groups WHERE group_id = ?", [groupId]);
console.log("Groupe toujours intact après les deux tentatives:", groupStillThere);

const [[allocation]] = await db.query("SELECT id, qty_delta FROM stock_movement_lot_allocations WHERE group_id = ? LIMIT 1", [groupId]);
let allocationUpdateRejected = false;
try {
  await db.query("UPDATE stock_movement_lot_allocations SET qty_delta = 999 WHERE id = ?", [allocation.id]);
  console.error("ECHEC DE LA PREUVE : l'UPDATE de l'allocation aurait dû être rejeté");
} catch (e) {
  allocationUpdateRejected = true;
  console.log("OK : UPDATE allocation rejeté comme attendu :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

let allocationDeleteRejected = false;
try {
  await db.query("DELETE FROM stock_movement_lot_allocations WHERE id = ?", [allocation.id]);
  console.error("ECHEC DE LA PREUVE : le DELETE de l'allocation aurait dû être rejeté");
} catch (e) {
  allocationDeleteRejected = true;
  console.log("OK : DELETE allocation rejeté comme attendu :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

const [[allocationStillThere]] = await db.query("SELECT id, qty_delta FROM stock_movement_lot_allocations WHERE id = ?", [allocation.id]);

await db.end();
process.exitCode = updateRejected && deleteRejected && stillThere && stillThere.qty_delta === 5
  && groupUpdateRejected && groupDeleteRejected && groupStillThere && groupStillThere.author === "rehearsal-script"
  && allocationUpdateRejected && allocationDeleteRejected && allocationStillThere && allocationStillThere.qty_delta === 5
  ? 0
  : 1;
