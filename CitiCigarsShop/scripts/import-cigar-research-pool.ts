import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import XLSX from "xlsx";
import dnaReference from "../shared/data/sourcing-pool-top25-v4.json";

const EXPECTED_DATABASE = "bwljrj22_citicigars_staging";
const SOURCE_VERSION = "top25v5";
const EXPECTED_SOURCE_ROWS = 925;
const EXPECTED_UNIQUE = 838;
const EXPLICIT_COMPOSITES = new Set(["CTG000875", "CTG000876", "CTG000877"]);
const HISTORICAL_WHITELIST = new Set([
  "CTG000001", "CTG000002", "CTG000003", "CTG000004", "CTG000005", "CTG000006",
  "CTG000008", "CTG000009", "CTG000011", "CTG000014", "CTG000015", "CTG000016",
  "CTG000018", "CTG000019", "CTG000020", "CTG000023", "CTG000027", "CTG000028",
  "CTG000029", "CTG000031", "CTG000032", "CTG000037", "CTG000039", "CTG000040",
  "CTG000041", "CTG000042",
]);

type Cell = string | number | boolean | null | undefined;
type PoolRow = {
  poolId: string; sourceCigarId: string | null; canonicalCigarId: string | null;
  brand: string; line: string; vitole: string | null; format: string | null;
  boxPressed: boolean | null; boxCount: number | null; length: string | null;
  ring: number | null; dimensions: string | null; strength: string | null;
  sourcingRating: string | null; originCountry: string | null; owner: string | null;
  factory: string | null; madeBy: string | null; wrapper: string | null;
  binder: string | null; filler: string | null; productStatus: string | null;
  technicalKey: string; sourceType: string; sourceVersion: string;
};
type EvidenceRow = {
  id: string; poolId: string; rankingSource: "CA" | "CJ"; rankingYear: number;
  rankingRank: number; rankingRating: number | null; officialSourceUrl: string | null;
  rankingSourceUrl: string | null; secondarySourceUrl: string | null;
  confidence: string | null; rawPayload: Record<string, Cell>;
};

const value = (cell: Cell): string | null => {
  const text = cell === null || cell === undefined ? "" : String(cell).trim();
  return !text || text === "(vide)" || text === "N/A" ? null : text;
};
const integer = (cell: Cell): number | null => {
  const parsed = Number.parseInt(value(cell) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const normalize = (cell: Cell): string => (value(cell) ?? "")
  .normalize("NFKC").toLocaleLowerCase("fr")
  .replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

const FRACTIONS: Record<string, number> = {
  "⅛": 0.125, "¼": 0.25, "⅜": 0.375, "½": 0.5,
  "⅝": 0.625, "¾": 0.75, "⅞": 0.875,
};
function normalizedLength(cell: Cell): string {
  let text = value(cell)?.replace(",", ".").trim() ?? "";
  for (const [glyph, fraction] of Object.entries(FRACTIONS)) {
    if (text.includes(glyph)) {
      const whole = Number.parseFloat(text.replace(glyph, "").trim() || "0");
      return String(whole + fraction);
    }
  }
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return String(Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]));
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return String(Number(fraction[1]) / Number(fraction[2]));
  return text.replace(/\.0+$/, "");
}
function dimensionsParts(cell: Cell): { length: string; ring: number | null } {
  const parts = (value(cell) ?? "").split(/\s*[×xX]\s*/);
  return { length: normalizedLength(parts[0]), ring: integer(parts[1]) };
}
function identity(brand: Cell, line: Cell, vitole: Cell, length: Cell, ring: Cell): string {
  return [normalize(brand), normalize(line), normalize(vitole), normalizedLength(length), integer(ring) ?? ""].join("|");
}
const stableId = (prefix: string, key: string) =>
  `${prefix}-${createHash("sha256").update(key).digest("hex").slice(0, 24).toUpperCase()}`;
const compositeText = (parts: Cell[]) => parts.map(normalize).join(" ");
function isComposite(parts: Cell[]): boolean {
  return /\b(coffret|sampler|bundle|assortiment|variety pack|mixed pack)\b/.test(compositeText(parts));
}

function workbookRows(source: string) {
  const workbook = XLSX.readFile(source, { cellDates: false });
  const topSheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<Cell[]>(topSheet, { header: 1, defval: null, raw: false });
  const headers = matrix[10].map((header) => String(header ?? ""));
  const topRows = matrix.slice(11).filter((row) => row[0] === "CA" || row[0] === "CJ");

  const dnaSheet = workbook.Sheets.DNA;
  const dnaMatrix = XLSX.utils.sheet_to_json<Cell[]>(dnaSheet, { header: 1, defval: null, raw: false });
  const dnaHeaders = dnaMatrix[2].map((header) => String(header ?? ""));
  const dnaRows = dnaMatrix.slice(3).filter((row) => /^CTG\d{6}$/.test(String(row[0] ?? "")));
  return { headers, topRows, dnaHeaders, dnaRows };
}

export function buildImportPlan(source: string) {
  const { headers, topRows, dnaHeaders, dnaRows } = workbookRows(source);
  const pools = new Map<string, PoolRow>();
  const identityToPoolId = new Map<string, string>();
  const evidence: EvidenceRow[] = [];
  const rejectedComposites: string[] = [];
  const ambiguousDetails = new Set<string>();

  for (const row of topRows) {
    const key = identity(row[4], row[5], row[6], row[10], row[11]);
    let poolId = identityToPoolId.get(key);
    if (!poolId) {
      poolId = stableId("POOL", key);
      identityToPoolId.set(key, poolId);
      const candidate: PoolRow = {
        poolId, sourceCigarId: null, canonicalCigarId: null,
        brand: value(row[4]) ?? "", line: value(row[5]) ?? "", vitole: value(row[6]),
        format: value(row[7]), boxPressed: value(row[8]) === null ? null : normalize(row[8]) === "oui",
        boxCount: integer(row[9]), length: value(row[10]), ring: integer(row[11]), dimensions: value(row[12]),
        strength: value(row[13]), sourcingRating: value(row[24]), originCountry: value(row[14]),
        owner: value(row[15]), factory: value(row[16]), madeBy: value(row[17]), wrapper: value(row[18]),
        binder: value(row[19]), filler: value(row[20]), productStatus: value(row[21]),
        technicalKey: `top25:${key}`, sourceType: "TOP25", sourceVersion: SOURCE_VERSION,
      };
      if (isComposite([candidate.line, candidate.vitole, candidate.format])) {
        rejectedComposites.push(`${candidate.brand} — ${candidate.line} — ${candidate.vitole ?? candidate.format ?? ""}`);
      } else {
        pools.set(poolId, candidate);
      }
    }
    if (!pools.has(poolId)) continue;
    const sourceName = row[0] as "CA" | "CJ";
    const year = integer(row[1]);
    const rank = integer(row[2]);
    if (!year || !rank) throw new Error(`Classement incomplet à la ligne ${evidence.length + 12}`);
    const evidenceKey = `${poolId}|${sourceName}|${year}|${rank}`;
    evidence.push({
      id: stableId("EVD", evidenceKey), poolId, rankingSource: sourceName, rankingYear: year,
      rankingRank: rank, rankingRating: integer(row[3]), officialSourceUrl: value(row[27]),
      rankingSourceUrl: value(row[28]), secondarySourceUrl: value(row[29]), confidence: value(row[23]),
      rawPayload: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])),
    });
  }

  const attachDocumentedCigar = (candidate: Record<string, unknown>, sourceType: string) => {
    const cigarId = String(candidate.cigarId ?? "");
    if (!cigarId || EXPLICIT_COMPOSITES.has(cigarId)) {
      if (EXPLICIT_COMPOSITES.has(cigarId)) rejectedComposites.push(cigarId);
      return null;
    }
    const dimensions = value(candidate.dimension as Cell) ?? value(candidate.dimensions as Cell);
    const parsed = dimensionsParts(dimensions);
    const key = identity(candidate.brand as Cell, candidate.line as Cell, candidate.vitole as Cell, parsed.length, parsed.ring);
    let poolId = identityToPoolId.get(key);
    if (!poolId) {
      poolId = stableId("POOL", key);
      identityToPoolId.set(key, poolId);
      pools.set(poolId, {
        poolId, sourceCigarId: cigarId, canonicalCigarId: cigarId,
        brand: value(candidate.brand as Cell) ?? "", line: value(candidate.line as Cell) ?? "",
        vitole: value(candidate.vitole as Cell), format: value(candidate.format as Cell), boxPressed: null,
        boxCount: null, length: parsed.length || null, ring: parsed.ring, dimensions,
        strength: null, sourcingRating: null, originCountry: null, owner: null, factory: null,
        madeBy: null, wrapper: null, binder: null, filler: null, productStatus: null,
        technicalKey: `${sourceType.toLowerCase()}:${key}`, sourceType, sourceVersion: SOURCE_VERSION,
      });
    } else {
      const pool = pools.get(poolId)!;
      if (pool.canonicalCigarId && pool.canonicalCigarId !== cigarId) {
        ambiguousDetails.add(`${pool.canonicalCigarId}|${cigarId}`);
        const alternateKey = `${key}|cigar_id:${normalize(cigarId)}`;
        poolId = stableId("POOL", alternateKey);
        identityToPoolId.set(alternateKey, poolId);
        pools.set(poolId, {
          poolId, sourceCigarId: cigarId, canonicalCigarId: cigarId,
          brand: value(candidate.brand as Cell) ?? "", line: value(candidate.line as Cell) ?? "",
          vitole: value(candidate.vitole as Cell), format: value(candidate.format as Cell), boxPressed: null,
          boxCount: null, length: parsed.length || null, ring: parsed.ring, dimensions,
          strength: null, sourcingRating: null, originCountry: null, owner: null, factory: null,
          madeBy: null, wrapper: null, binder: null, filler: null, productStatus: null,
          technicalKey: `${sourceType.toLowerCase()}:${alternateKey}`, sourceType, sourceVersion: SOURCE_VERSION,
        });
        return poolId;
      }
      if (!pool.canonicalCigarId) {
        pool.canonicalCigarId = cigarId;
        pool.sourceCigarId = cigarId;
      }
    }
    return poolId;
  };

  const existingProfileLinks = new Map<string, string>();
  for (const candidate of dnaReference.candidates as Array<Record<string, unknown>>) {
    const poolId = attachDocumentedCigar(candidate, "EXISTING_DNA");
    if (poolId) existingProfileLinks.set(String(candidate.cigarId), poolId);
  }

  const dnaById = new Map(dnaRows.map((row) => [String(row[0]), row]));
  for (const cigarId of EXPLICIT_COMPOSITES) {
    if (dnaById.has(cigarId)) rejectedComposites.push(cigarId);
  }
  const historicalWhitelistLinks = new Map<string, string>();
  for (const cigarId of HISTORICAL_WHITELIST) {
    const row = dnaById.get(cigarId);
    if (!row) continue;
    const candidate = {
      cigarId, brand: row[2], line: row[3], vitole: row[4], format: row[5], dimension: row[10],
    };
    const poolId = attachDocumentedCigar(candidate, "HISTORICAL_WHITELIST");
    if (poolId) historicalWhitelistLinks.set(cigarId, poolId);
  }

  const report = {
    top25_source_rows: topRows.length,
    top25_unique_cigars: new Set(topRows.map((row) => identity(row[4], row[5], row[6], row[10], row[11]))).size,
    duplicate_appearances: topRows.length - EXPECTED_UNIQUE,
    pool_inserts: pools.size,
    pool_updates: 0,
    evidence_inserts: evidence.length,
    evidence_updates: 0,
    existing_profile_links: existingProfileLinks.size,
    historical_whitelist_links: historicalWhitelistLinks.size,
    ambiguous_matches: ambiguousDetails.size,
    ambiguous_details: [...ambiguousDetails],
    rejected_composites: [...new Set(rejectedComposites)],
    unmatched_rows: 0,
  };
  return { pools, evidence, existingProfileLinks, historicalWhitelistLinks, identityToPoolId, ambiguousDetails, report, dnaHeaders };
}

async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const source = path.resolve(sourceIndex >= 0 ? args[sourceIndex + 1] : "_local_imports/top25v5.xlsx");
  const write = args.includes("--write");
  const plan = buildImportPlan(source);
  const gateOk = plan.report.top25_source_rows === EXPECTED_SOURCE_ROWS &&
    plan.report.top25_unique_cigars === EXPECTED_UNIQUE;

  if (!gateOk) {
    console.error(JSON.stringify({ mode: "STOPPED", gate: "FAILED", expected: {
      top25_source_rows: EXPECTED_SOURCE_ROWS, top25_unique_cigars: EXPECTED_UNIQUE,
    }, ...plan.report }, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!write) {
    console.log(JSON.stringify({ mode: "DRY_RUN", gate: "PASSED", ...plan.report }, null, 2));
    return;
  }
  const databaseUrl = process.env.MYSQL_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("MYSQL_URL ou DATABASE_URL est requis avec --write");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [[databaseRow]] = await connection.query<Array<{ databaseName: string }>>(
      "SELECT DATABASE() AS databaseName",
    );
    if (databaseRow.databaseName !== EXPECTED_DATABASE) {
      throw new Error(`STOP_WRONG_DATABASE: ${databaseRow.databaseName ?? "NULL"}`);
    }

    const [catalogRows] = await connection.query<Array<{
      cigar_id: string; marque: string; ligne: string; vitole: string; format: string | null;
      dimensions: string | null; ring_gauge: number | null; review_status: string | null;
    }>>(`
      SELECT c.cigar_id,c.marque,c.ligne,c.vitole,c.format,c.dimensions,c.ring_gauge,r.status AS review_status
      FROM cigar_catalog c LEFT JOIN cigar_dna_reviews r ON r.cigar_id=c.cigar_id
    `);
    const catalogByIdentity = new Map<string, typeof catalogRows>();
    for (const row of catalogRows) {
      if (EXPLICIT_COMPOSITES.has(row.cigar_id) || isComposite([row.marque, row.ligne, row.vitole, row.format])) continue;
      const parsed = dimensionsParts(row.dimensions);
      const key = identity(row.marque, row.ligne, row.vitole, parsed.length, row.ring_gauge ?? parsed.ring);
      const list = catalogByIdentity.get(key) ?? [];
      list.push(row);
      catalogByIdentity.set(key, list);
    }
    const catalogLinks = new Map<string, string>();
    let dbProfileLinks = 0;
    for (const [key, rows] of catalogByIdentity) {
      if (rows.length > 1) {
        if (plan.identityToPoolId.has(key)) plan.ambiguousDetails.add(rows.map((row) => row.cigar_id).sort().join("|"));
        continue;
      }
      const row = rows[0];
      let linkedPoolId = plan.identityToPoolId.get(key);
      if (!linkedPoolId && row.review_status) {
        linkedPoolId = stableId("POOL", key);
        plan.identityToPoolId.set(key, linkedPoolId);
        const parsed = dimensionsParts(row.dimensions);
        plan.pools.set(linkedPoolId, {
          poolId: linkedPoolId, sourceCigarId: row.cigar_id, canonicalCigarId: row.cigar_id,
          brand: row.marque, line: row.ligne, vitole: value(row.vitole), format: value(row.format),
          boxPressed: null, boxCount: null, length: parsed.length || null,
          ring: row.ring_gauge ?? parsed.ring, dimensions: value(row.dimensions), strength: null,
          sourcingRating: null, originCountry: null, owner: null, factory: null, madeBy: null,
          wrapper: null, binder: null, filler: null, productStatus: null,
          technicalKey: `existing_db:${key}`, sourceType: "EXISTING_DNA", sourceVersion: SOURCE_VERSION,
        });
      }
      if (!linkedPoolId) continue;
      const pool = plan.pools.get(linkedPoolId)!;
      if (pool.canonicalCigarId && pool.canonicalCigarId !== row.cigar_id) {
        plan.ambiguousDetails.add([pool.canonicalCigarId, row.cigar_id].sort().join("|"));
        continue;
      }
      pool.canonicalCigarId = row.cigar_id;
      pool.sourceCigarId ??= row.cigar_id;
      catalogLinks.set(row.cigar_id, linkedPoolId);
      if (row.review_status) dbProfileLinks += 1;
    }
    plan.report.existing_profile_links = Math.max(plan.report.existing_profile_links, dbProfileLinks);
    plan.report.ambiguous_matches = plan.ambiguousDetails.size;
    plan.report.ambiguous_details = [...plan.ambiguousDetails];
    plan.report.pool_inserts = plan.pools.size;

    const [[before]] = await connection.query<Array<Record<string, number>>>(`
      SELECT
        (SELECT COUNT(*) FROM cigar_research_pool) AS pool_count,
        (SELECT COUNT(*) FROM cigar_research_pool_evidence) AS evidence_count,
        (SELECT COUNT(*) FROM cigar_dna_reviews) AS legacy_review_count,
        (SELECT COUNT(*) FROM dna_research_cases) AS case_count
    `);
    const [existingPoolRows] = await connection.query<Array<{ pool_id: string }>>(
      "SELECT pool_id FROM cigar_research_pool",
    );
    const [existingEvidenceRows] = await connection.query<Array<{ id: string }>>(
      "SELECT id FROM cigar_research_pool_evidence",
    );
    const existingPools = new Set(existingPoolRows.map((row) => row.pool_id));
    const existingEvidence = new Set(existingEvidenceRows.map((row) => row.id));

    await connection.beginTransaction();
    for (const pool of plan.pools.values()) {
      await connection.execute(`
        INSERT INTO cigar_research_pool (
          pool_id, source_cigar_id, canonical_cigar_id, brand, line, vitole, format,
          box_pressed, box_count, length, ring, dimensions, strength, sourcing_rating,
          origin_country, owner, factory, made_by, wrapper, binder, filler, product_status,
          technical_key, source_type, source_version
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          source_cigar_id=COALESCE(source_cigar_id,VALUES(source_cigar_id)),
          canonical_cigar_id=COALESCE(canonical_cigar_id,VALUES(canonical_cigar_id)),
          brand=VALUES(brand), line=VALUES(line), vitole=VALUES(vitole), format=VALUES(format),
          box_pressed=VALUES(box_pressed), box_count=VALUES(box_count), length=VALUES(length),
          ring=VALUES(ring), dimensions=VALUES(dimensions), strength=VALUES(strength),
          sourcing_rating=VALUES(sourcing_rating), origin_country=VALUES(origin_country), owner=VALUES(owner),
          factory=VALUES(factory), made_by=VALUES(made_by), wrapper=VALUES(wrapper), binder=VALUES(binder),
          filler=VALUES(filler), product_status=VALUES(product_status), source_version=VALUES(source_version)
      `, Object.values(pool));
    }
    for (const item of plan.evidence) {
      try {
        await connection.execute(`
        INSERT INTO cigar_research_pool_evidence (
          id,pool_id,ranking_source,ranking_year,ranking_rank,ranking_rating,
          official_source_url,ranking_source_url,secondary_source_url,confidence,raw_payload
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE ranking_rating=VALUES(ranking_rating),
          official_source_url=VALUES(official_source_url), ranking_source_url=VALUES(ranking_source_url),
          secondary_source_url=VALUES(secondary_source_url), confidence=VALUES(confidence), raw_payload=VALUES(raw_payload)
        `, [item.id, item.poolId, item.rankingSource, item.rankingYear, item.rankingRank,
          item.rankingRating, item.officialSourceUrl, item.rankingSourceUrl,
          item.secondarySourceUrl, item.confidence, JSON.stringify(item.rawPayload)]);
      } catch (error) {
        throw new Error(`EVIDENCE_WRITE_FAILED ${item.id} pool=${item.poolId}: ${error instanceof Error ? error.message : error}`);
      }
    }
    const allLinks = new Map([...catalogLinks, ...plan.existingProfileLinks, ...plan.historicalWhitelistLinks]);
    for (const [cigarId, poolId] of allLinks) {
      await connection.execute(
        "UPDATE cigar_catalog SET pool_id=? WHERE cigar_id=? AND (pool_id IS NULL OR pool_id=?)",
        [poolId, cigarId, poolId],
      );
      await connection.execute(
        "UPDATE cigar_research_pool SET canonical_cigar_id=?, source_cigar_id=COALESCE(source_cigar_id,?) WHERE pool_id=?",
        [cigarId, cigarId, poolId],
      );
    }
    await connection.execute(`
      INSERT IGNORE INTO dna_research_cases (
        case_id,pool_id,cigar_id,status,case_type,research_mode,current_profile_snapshot,
        proposed_profile,final_profile,memo_research,memo_validation,approved_by,approved_at,created_at,updated_at
      )
      SELECT CONCAT('LEGACY-',r.cigar_id),c.pool_id,r.cigar_id,r.status,'CREATE','AGENT',
        CASE WHEN r.status='APPROVED' THEN r.final_profile ELSE NULL END,
        r.proposed_profile,r.final_profile,r.memo_research,r.memo_validation,
        r.approved_by,r.approved_at,r.created_at,r.updated_at
      FROM cigar_dna_reviews r JOIN cigar_catalog c ON c.cigar_id=r.cigar_id
      WHERE c.pool_id IS NOT NULL
    `);
    await connection.commit();

    const [[after]] = await connection.query<Array<Record<string, number>>>(`
      SELECT
        (SELECT COUNT(*) FROM cigar_research_pool) AS pool_count,
        (SELECT COUNT(*) FROM cigar_research_pool_evidence) AS evidence_count,
        (SELECT COUNT(*) FROM cigar_dna_reviews) AS legacy_review_count,
        (SELECT COUNT(*) FROM dna_research_cases) AS case_count,
        (SELECT COUNT(*) FROM cigar_catalog WHERE pool_id IS NOT NULL) AS catalog_pool_links
    `);
    console.log(JSON.stringify({
      mode: "WRITE", gate: "PASSED", database: databaseRow.databaseName,
      before, after, ...plan.report,
      pool_inserts: [...plan.pools.keys()].filter((id) => !existingPools.has(id)).length,
      pool_updates: [...plan.pools.keys()].filter((id) => existingPools.has(id)).length,
      evidence_inserts: plan.evidence.filter((item) => !existingEvidence.has(item.id)).length,
      evidence_updates: plan.evidence.filter((item) => existingEvidence.has(item.id)).length,
    }, null, 2));
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
