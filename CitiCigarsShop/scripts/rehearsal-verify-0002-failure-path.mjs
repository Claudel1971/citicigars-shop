// Preuve du CAS D'ECHEC (pas seulement le cas nominal deja valide par le
// `drizzle-kit migrate` reel) : si skus est incoherent avec products+bundles,
// la procedure de 0002 doit reellement SIGNALer une erreur, contrairement a
// l'ancien SELECT IF(...,1,1/0) qui ne faisait qu'un warning silencieux.
import mysql from "mysql2/promise";
const db = await mysql.createConnection({ host: "127.0.0.1", port: 3399, database: "citicigars_rehearsal", multipleStatements: true });

// Casse volontairement la coherence : ajoute une ligne skus surnuméraire.
// (Note : DELETE d'une ligne existante est maintenant bloqué par la FK
// products.sku->skus.sku posée en 0004 -- preuve involontaire mais bienvenue
// que cette FK protège déjà contre un skus incohérent après coup. On simule
// donc l'incohérence dans l'autre sens : une ligne skus sans produit/bundle.)
await db.query("INSERT INTO skus (sku, kind) VALUES ('REHEARSAL-ORPHAN-SKU', 'ACCESSORY')");
const [[before]] = await db.query("SELECT (SELECT COUNT(*) FROM skus) AS skus_count, (SELECT COUNT(*) FROM products)+(SELECT COUNT(*) FROM bundles) AS expected");
console.log("Etat volontairement incoherent:", before);

// Rejoue exactement la même procédure que dans 0002 (recréée à l'identique).
await db.query("DROP PROCEDURE IF EXISTS `_verify_skus_backfill`");
await db.query(`
CREATE PROCEDURE \`_verify_skus_backfill\`()
BEGIN
  DECLARE cnt_skus INT;
  DECLARE cnt_expected INT;
  SELECT COUNT(*) INTO cnt_skus FROM \`skus\`;
  SELECT (SELECT COUNT(*) FROM \`products\`) + (SELECT COUNT(*) FROM \`bundles\`) INTO cnt_expected;
  IF cnt_skus <> cnt_expected THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'backfill_skus_count_mismatch';
  END IF;
END
`);

let signaled = false;
try {
  await db.query("CALL `_verify_skus_backfill`()");
  console.error("ECHEC DE LA PREUVE : la procedure aurait du SIGNALer une erreur mais ne l'a pas fait");
} catch (e) {
  signaled = true;
  console.log("OK : la procedure a bien SIGNALe une vraie erreur SQL :", e.sqlMessage || e.message, "| sqlState=", e.sqlState);
}

await db.query("DROP PROCEDURE `_verify_skus_backfill`");

// Comparaison directe avec l'ancien mécanisme, pour montrer la différence concrète.
console.log("\n--- Comparaison avec l'ancien mécanisme SELECT IF(...,1,1/0) sur ce même état incohérent ---");
try {
  const [rows] = await db.query(
    "SELECT IF((SELECT COUNT(*) FROM skus) = (SELECT COUNT(*) FROM products)+(SELECT COUNT(*) FROM bundles), 1, 1/0) AS backfill_check"
  );
  console.log("L'ancien mécanisme N'A PAS levé d'erreur. Résultat renvoyé silencieusement:", rows[0]);
} catch (e) {
  console.log("(inattendu) l'ancien mécanisme a levé une erreur:", e.message);
}

// Remet skus dans un état cohérent pour ne pas fausser une inspection ultérieure de cette DB jetable.
await db.query("DELETE FROM skus WHERE sku='REHEARSAL-ORPHAN-SKU'");

await db.end();
process.exitCode = signaled ? 0 : 1;
