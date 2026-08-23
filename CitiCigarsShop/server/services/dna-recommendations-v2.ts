import { stockStorage } from "../storage.stock";

type Availability = { packAvailable: boolean; boxAvailable: boolean };

export interface DnaClientProfileV2 {
  families: [string, string];
  power: number | string | null;
  intensity: number | string | null;
  durationWindow: string;
  spice: number | string | null;
  sweet: number | string | null;
  signature: string | null;
}

interface MasterDnaCandidateV5 {
  cigarId: string;
  sku: string;
  brand: string;
  line: string;
  vitole: string | null;
  dimension: string | null;
  format: string | null;
  puissance: number | string | null;
  famille1: string | null;
  famille2: string | null;
  famille3: string | null;
  intensite: number | string | null;
  spice: number | string | null;
  sweet: number | string | null;
  signatures: string[];
  dureeMin: number | string | null;
  dureeMax: number | string | null;
  confidence: string | null;
  curatorEligible: boolean;
}

interface DnaRankedCore {
  cigarId: string;
  sku: string;
  score: number;
  decomposition: {
    famille: number;
    intensite: number;
    puissance: number;
    duree: number;
    affinage: number;
  };
  dataConfidence: string;
}

export interface LiveDnaCandidateV2 extends DnaRankedCore {
  brand: string;
  line: string;
  vitole: string | null;
  dimension: string | null;
  format: string | null;
  availability: Availability;
}

const dnaEngineV2 = require("../../shared/dna-engine-v2.cjs") as {
  rankCandidates(client: DnaClientProfileV2, cigars: MasterDnaCandidateV5[]): DnaRankedCore[];
};

const masterDnaV5 = require("../../shared/master-dna-v5.cjs") as {
  SOURCE_VERSION: string;
  CANDIDATES: MasterDnaCandidateV5[];
  EXCLUDED_SKUS: string[];
};

function assertValidClientProfile(client: DnaClientProfileV2): void {
  if (!client || !Array.isArray(client.families) || client.families.length !== 2) {
    throw new Error("DNA_V2_INVALID_CLIENT_FAMILIES: exactly two families are required");
  }
  if (!client.families[0] || !client.families[1] || client.families[0] === client.families[1]) {
    throw new Error("DNA_V2_INVALID_CLIENT_FAMILIES: two distinct non-empty families are required");
  }
}

/**
 * Pure part of Task 5: combine MASTER v5 DNA scoring data with a live
 * availability snapshot. No database access here, which makes the behavior
 * deterministic and directly testable.
 *
 * IMPORTANT: "Réservé - activation" exclusions are applied BEFORE scoring.
 * Availability is fail-closed: a missing CIGAR_ID in the supplied live map is
 * treated as unavailable, never as a fallback to the old static catalog.
 */
export function rankDnaCandidatesWithAvailability(
  client: DnaClientProfileV2,
  availabilityByCigarId: Record<string, Availability>,
): LiveDnaCandidateV2[] {
  assertValidClientProfile(client);

  const eligibleMaster = masterDnaV5.CANDIDATES.filter((c) => c.curatorEligible === true);
  const liveCandidates = eligibleMaster.filter((c) => {
    const a = availabilityByCigarId[c.cigarId];
    return !!a && (a.packAvailable || a.boxAvailable);
  });

  const ranked = dnaEngineV2.rankCandidates(client, liveCandidates);
  const byCigarId = new Map(eligibleMaster.map((c) => [c.cigarId, c]));

  return ranked.map((r) => {
    const source = byCigarId.get(r.cigarId);
    if (!source) {
      throw new Error(`DNA_V2_INTERNAL_MAPPING_ERROR: ${r.cigarId}`);
    }
    return {
      ...r,
      brand: source.brand,
      line: source.line,
      vitole: source.vitole,
      dimension: source.dimension,
      format: source.format,
      availability: availabilityByCigarId[r.cigarId],
    };
  });
}

/**
 * Live part of Task 5.
 *
 * We deliberately resolve availability by stable CIGAR_ID through Stock Central
 * instead of joining MASTER v5's new CTCG SKU directly to stock_balances.
 * This keeps Task 5 valid both before and after the pending legacy->CTCG staging
 * SKU migration: products/cigar_catalog resolve the current DB SKU, while
 * MASTER v5 remains the source of DNA sensory/scoring attributes.
 *
 * Any unresolved CIGAR_ID is an integrity error and fails closed.
 */
export async function getLiveDnaRankingV2(client: DnaClientProfileV2): Promise<{
  sourceVersion: string;
  ranked: LiveDnaCandidateV2[];
}> {
  assertValidClientProfile(client);

  const eligibleIds = masterDnaV5.CANDIDATES
    .filter((c) => c.curatorEligible === true)
    .map((c) => c.cigarId);

  const { resolved, unresolved } = await stockStorage.getAvailabilityForCigarIds(eligibleIds);
  if (unresolved.length > 0) {
    throw new Error(`DNA_V2_UNRESOLVED_CIGAR_IDS: ${unresolved.join(",")}`);
  }

  return {
    sourceVersion: masterDnaV5.SOURCE_VERSION,
    ranked: rankDnaCandidatesWithAvailability(client, resolved),
  };
}

export function getMasterDnaV5Diagnostics(): {
  sourceVersion: string;
  totalCandidates: number;
  eligibleCandidates: number;
  excludedCandidates: number;
  excludedSkus: string[];
} {
  const totalCandidates = masterDnaV5.CANDIDATES.length;
  const eligibleCandidates = masterDnaV5.CANDIDATES.filter((c) => c.curatorEligible === true).length;
  return {
    sourceVersion: masterDnaV5.SOURCE_VERSION,
    totalCandidates,
    eligibleCandidates,
    excludedCandidates: totalCandidates - eligibleCandidates,
    excludedSkus: [...masterDnaV5.EXCLUDED_SKUS],
  };
}
