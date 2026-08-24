import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, isNull, like, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "./db.mysql";
import { requireAdminAuth } from "./middleware/auth";
import { researchCigarDna } from "./services/dna-research-agent";
import {
  cigarCatalog,
  cigarDnaReviews,
  cigarResearchPool,
  cigarResearchPoolEvidence,
  dnaResearchCases,
} from "../shared/schema.stock";
import { changedDnaFields, DNA_PROFILE_FIELDS, sanitizeDnaProfile } from "../shared/dna-profile";
import dnaReference from "../shared/data/sourcing-pool-top25-v4.json";

const ACTIVE_CASE_STATUSES = ["DRAFT", "RESEARCHED", "REVIEW"] as const;
const referenceProfiles = new Map(
  dnaReference.candidates.map((candidate) => [candidate.cigarId, {
    brand: candidate.brand,
    line: candidate.line,
    vitole: candidate.vitole,
    format: candidate.format,
    dimensions: candidate.dimension,
    puissance: candidate.puissance,
    famille1: candidate.famille1,
    famille2: candidate.famille2,
    famille3: candidate.famille3,
    intensite: candidate.intensite,
    spice: candidate.spice,
    sweet: candidate.sweet,
    signatures: candidate.signatures,
    dureeMin: candidate.dureeMin,
    dureeMax: candidate.dureeMax,
    confidence: candidate.confidence,
  }]),
);
const sourcingRatings = new Map(
  dnaReference.candidates.map((candidate) => [candidate.cigarId, candidate.sourcingClass ?? null]),
);
const referenceCigarIds = Array.from(referenceProfiles.keys());

function isComposite(value: unknown): boolean {
  const text = String(value ?? "").normalize("NFKC").toLocaleLowerCase("fr");
  return /\b(coffret|sampler|bundle|assortiment|variety pack|mixed pack)\b/.test(text);
}
function safeLimit(value: unknown, fallback = 20): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(50, Math.max(1, parsed)) : fallback;
}
function currentProfile(
  cigarId: string | null,
  approved: Record<string, unknown> | null | undefined,
) {
  return sanitizeDnaProfile(approved) ?? (cigarId ? referenceProfiles.get(cigarId) ?? null : null);
}
function caseId() {
  return `CASE-${randomUUID().replace(/-/g, "").toUpperCase()}`;
}
function poolId() {
  return `POOL-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

export function registerResearchPoolRoutes(app: Express): void {
  // Référentiel public, paginé et server-side, utilisé par le Bloc 3 du Curator.
  // Aucune classe sourcing n'est filtrée ni modifiée par cette sélection.
  app.get("/api/dna/research-pool/brands", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const query = db.selectDistinct({ brand: cigarResearchPool.brand }).from(cigarResearchPool);
    const rows = q
      ? await query.where(like(cigarResearchPool.brand, `%${q}%`)).orderBy(cigarResearchPool.brand).limit(30)
      : await query.orderBy(cigarResearchPool.brand).limit(30);
    res.json({ rows });
  });

  app.get("/api/dna/research-pool/cigars", async (req, res) => {
    const brand = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!brand) return res.status(400).json({ error: "brand_required" });
    const conditions = [eq(cigarResearchPool.brand, brand)];
    if (q) conditions.push(or(like(cigarResearchPool.line, `%${q}%`),
      like(cigarResearchPool.vitole, `%${q}%`), like(cigarResearchPool.format, `%${q}%`))!);
    const rows = await db.select({
      referenceId: cigarResearchPool.poolId, marque: cigarResearchPool.brand,
      ligne: cigarResearchPool.line, vitole: cigarResearchPool.vitole,
      format: cigarResearchPool.format, dimension: cigarResearchPool.dimensions,
    }).from(cigarResearchPool).where(and(...conditions))
      .orderBy(cigarResearchPool.line, cigarResearchPool.vitole).limit(30);
    res.json({ rows });
  });

  app.get("/api/admin/research-pool", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const brand = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
      const dna = req.query.dna === "yes" || req.query.dna === "no" ? req.query.dna : "all";
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = safeLimit(req.query.limit);
      const conditions = [];
      if (q) {
        const pattern = `%${q}%`;
        conditions.push(or(
          like(cigarResearchPool.brand, pattern), like(cigarResearchPool.line, pattern),
          like(cigarResearchPool.vitole, pattern), like(cigarResearchPool.factory, pattern),
          like(cigarResearchPool.madeBy, pattern), like(cigarResearchPool.poolId, pattern),
          like(cigarResearchPool.canonicalCigarId, pattern),
        )!);
      }
      if (brand) conditions.push(eq(cigarResearchPool.brand, brand));
      if (dna === "yes") {
        conditions.push(or(
          inArray(cigarCatalog.cigarId, referenceCigarIds),
          eq(cigarDnaReviews.status, "APPROVED"),
        )!);
      } else if (dna === "no") {
        conditions.push(and(
          or(isNull(cigarCatalog.cigarId), notInArray(cigarCatalog.cigarId, referenceCigarIds)),
          or(isNull(cigarDnaReviews.status), ne(cigarDnaReviews.status, "APPROVED")),
        )!);
      }
      const where = conditions.length ? and(...conditions) : undefined;
      const [{ total }] = await db.select({ total: sql<number>`count(*)` })
        .from(cigarResearchPool)
        .leftJoin(cigarCatalog, eq(cigarCatalog.poolId, cigarResearchPool.poolId))
        .leftJoin(cigarDnaReviews, eq(cigarDnaReviews.cigarId, cigarCatalog.cigarId))
        .where(where);
      const rows = await db.select({
        poolId: cigarResearchPool.poolId, cigarId: cigarCatalog.cigarId,
        brand: cigarResearchPool.brand, line: cigarResearchPool.line,
        vitole: cigarResearchPool.vitole, format: cigarResearchPool.format,
        dimensions: cigarResearchPool.dimensions, sourcingRating: cigarResearchPool.sourcingRating,
        originCountry: cigarResearchPool.originCountry,
        factory: cigarResearchPool.factory, madeBy: cigarResearchPool.madeBy,
      }).from(cigarResearchPool)
        .leftJoin(cigarCatalog, eq(cigarCatalog.poolId, cigarResearchPool.poolId))
        .leftJoin(cigarDnaReviews, eq(cigarDnaReviews.cigarId, cigarCatalog.cigarId))
        .where(where).orderBy(cigarResearchPool.brand, cigarResearchPool.line, cigarResearchPool.vitole)
        .limit(limit).offset((page - 1) * limit);

      const cigarIds = rows.flatMap((row) => row.cigarId ? [row.cigarId] : []);
      const poolIds = rows.map((row) => row.poolId);
      const approvedReviews = cigarIds.length ? await db.select({
        cigarId: cigarDnaReviews.cigarId, finalProfile: cigarDnaReviews.finalProfile,
      }).from(cigarDnaReviews).where(and(
        inArray(cigarDnaReviews.cigarId, cigarIds), eq(cigarDnaReviews.status, "APPROVED"),
      )) : [];
      const activeCases = poolIds.length ? await db.select({
        caseId: dnaResearchCases.caseId, poolId: dnaResearchCases.poolId,
        status: dnaResearchCases.status,
      }).from(dnaResearchCases).where(and(
        inArray(dnaResearchCases.poolId, poolIds), inArray(dnaResearchCases.status, [...ACTIVE_CASE_STATUSES]),
      )).orderBy(desc(dnaResearchCases.createdAt)) : [];
      const reviewMap = new Map(approvedReviews.map((row) => [row.cigarId, row.finalProfile]));
      const activeMap = new Map(activeCases.map((row) => [row.poolId, row]));
      res.json({
        page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit),
        profileFields: DNA_PROFILE_FIELDS,
        rows: rows.map((row) => {
          const profile = currentProfile(row.cigarId, row.cigarId ? reviewMap.get(row.cigarId) as Record<string, unknown> : null);
          return { ...row, sourcingRating: row.sourcingRating ?? (row.cigarId ? sourcingRatings.get(row.cigarId) ?? null : null),
            hasExistingDna: Boolean(profile), activeCase: activeMap.get(row.poolId) ?? null };
        }),
      });
    } catch (error) {
      console.error("Research Pool search error", error);
      res.status(500).json({ error: "research_pool_search_failed" });
    }
  });

  app.get("/api/admin/research-pool/brands", requireAdminAuth, async (_req, res) => {
    const rows = await db.selectDistinct({ brand: cigarResearchPool.brand })
      .from(cigarResearchPool).orderBy(cigarResearchPool.brand).limit(500);
    res.json({ rows });
  });

  app.get("/api/admin/research-pool/:poolId", requireAdminAuth, async (req, res) => {
    const [pool] = await db.select({
      pool: cigarResearchPool, cigarId: cigarCatalog.cigarId,
    }).from(cigarResearchPool).leftJoin(cigarCatalog, eq(cigarCatalog.poolId, cigarResearchPool.poolId))
      .where(eq(cigarResearchPool.poolId, req.params.poolId)).limit(1);
    if (!pool) return res.status(404).json({ error: "pool_candidate_not_found" });
    const evidence = await db.select().from(cigarResearchPoolEvidence)
      .where(eq(cigarResearchPoolEvidence.poolId, req.params.poolId))
      .orderBy(desc(cigarResearchPoolEvidence.rankingYear), cigarResearchPoolEvidence.rankingSource, cigarResearchPoolEvidence.rankingRank);
    const cases = await db.select().from(dnaResearchCases)
      .where(eq(dnaResearchCases.poolId, req.params.poolId)).orderBy(desc(dnaResearchCases.createdAt));
    const review = pool.cigarId ? (await db.select().from(cigarDnaReviews)
      .where(and(eq(cigarDnaReviews.cigarId, pool.cigarId), eq(cigarDnaReviews.status, "APPROVED"))).limit(1))[0] : null;
    const profile = currentProfile(pool.cigarId, review?.finalProfile as Record<string, unknown> | null);
    res.json({ ...pool.pool, cigarId: pool.cigarId, evidence, cases,
      sourcingRating: pool.pool.sourcingRating ?? (pool.cigarId ? sourcingRatings.get(pool.cigarId) ?? null : null),
      hasExistingDna: Boolean(profile), currentProfile: profile, profileFields: DNA_PROFILE_FIELDS });
  });

  app.post("/api/admin/research-pool", requireAdminAuth, async (req, res) => {
    const brand = String(req.body?.brand ?? "").trim();
    const line = String(req.body?.line ?? "").trim();
    const vitole = String(req.body?.vitole ?? "").trim();
    const format = String(req.body?.format ?? "").trim() || null;
    const dimensions = String(req.body?.dimensions ?? "").trim() || null;
    const note = String(req.body?.note ?? "").trim() || null;
    if (!brand || !line || !vitole) return res.status(400).json({ error: "brand_line_vitole_required" });
    if (isComposite([brand, line, vitole, format].join(" "))) return res.status(422).json({ error: "composites_forbidden" });
    const id = poolId();
    await db.insert(cigarResearchPool).values({
      poolId: id, brand, line, vitole, format, dimensions,
      technicalKey: `manual:${id}`, sourceType: "MANUAL", sourceVersion: "manual-v1",
      productStatus: note,
    });
    res.status(201).json({ poolId: id, cigarId: null });
  });

  app.post("/api/admin/dna-research-cases", requireAdminAuth, async (req, res) => {
    const requested: string[] = Array.isArray(req.body?.poolIds)
      ? Array.from(new Set<string>(req.body.poolIds.map(String))).slice(0, 50)
      : [];
    if (!requested.length) return res.status(400).json({ error: "pool_ids_required" });
    const pools = await db.select({ poolId: cigarResearchPool.poolId, cigarId: cigarCatalog.cigarId })
      .from(cigarResearchPool).leftJoin(cigarCatalog, eq(cigarCatalog.poolId, cigarResearchPool.poolId))
      .where(inArray(cigarResearchPool.poolId, requested));
    const existing = await db.select().from(dnaResearchCases).where(and(
      inArray(dnaResearchCases.poolId, requested), inArray(dnaResearchCases.status, [...ACTIVE_CASE_STATUSES]),
    )).orderBy(desc(dnaResearchCases.createdAt));
    const existingByPool = new Map(existing.map((item) => [item.poolId, item]));
    const created = [];
    for (const pool of pools) {
      const found = existingByPool.get(pool.poolId);
      if (found) { created.push(found); continue; }
      const id = caseId();
      await db.insert(dnaResearchCases).values({ caseId: id, poolId: pool.poolId, cigarId: pool.cigarId, status: "DRAFT" });
      created.push({ caseId: id, poolId: pool.poolId, cigarId: pool.cigarId, status: "DRAFT" });
    }
    res.status(201).json({ cases: created });
  });

  app.get("/api/admin/dna-research-cases/:caseId", requireAdminAuth, async (req, res) => {
    const [row] = await db.select({ case: dnaResearchCases, pool: cigarResearchPool })
      .from(dnaResearchCases).innerJoin(cigarResearchPool, eq(cigarResearchPool.poolId, dnaResearchCases.poolId))
      .where(eq(dnaResearchCases.caseId, req.params.caseId)).limit(1);
    if (!row) return res.status(404).json({ error: "research_case_not_found" });
    const review = row.case.cigarId ? (await db.select().from(cigarDnaReviews)
      .where(and(eq(cigarDnaReviews.cigarId, row.case.cigarId), eq(cigarDnaReviews.status, "APPROVED"))).limit(1))[0] : null;
    const approved = currentProfile(row.case.cigarId, review?.finalProfile as Record<string, unknown> | null);
    const current = sanitizeDnaProfile(row.case.currentProfileSnapshot) ?? approved;
    const evidence = await db.select().from(cigarResearchPoolEvidence)
      .where(eq(cigarResearchPoolEvidence.poolId, row.pool.poolId))
      .orderBy(desc(cigarResearchPoolEvidence.rankingYear), cigarResearchPoolEvidence.rankingSource, cigarResearchPoolEvidence.rankingRank);
    res.json({ ...row.case, pool: row.pool, hasExistingDna: Boolean(approved), currentProfile: current,
      evidence, changedFields: changedDnaFields(current, sanitizeDnaProfile(row.case.finalProfile)), profileFields: DNA_PROFILE_FIELDS });
  });

  app.post("/api/admin/dna-research-cases/:caseId/update-direct", requireAdminAuth, async (req, res) => {
    const [item] = await db.select().from(dnaResearchCases).where(eq(dnaResearchCases.caseId, req.params.caseId)).limit(1);
    if (!item) return res.status(404).json({ error: "research_case_not_found" });
    const review = item.cigarId ? (await db.select().from(cigarDnaReviews)
      .where(and(eq(cigarDnaReviews.cigarId, item.cigarId), eq(cigarDnaReviews.status, "APPROVED"))).limit(1))[0] : null;
    const profile = currentProfile(item.cigarId, review?.finalProfile as Record<string, unknown> | null);
    if (!profile) return res.status(409).json({ error: "existing_profile_required" });
    await db.update(dnaResearchCases).set({ caseType: "UPDATE", researchMode: "DIRECT", status: "REVIEW",
      currentProfileSnapshot: profile, proposedProfile: profile, finalProfile: structuredClone(profile) })
      .where(eq(dnaResearchCases.caseId, item.caseId));
    res.json({ caseId: item.caseId, status: "REVIEW", currentProfile: profile, finalProfile: profile });
  });

  app.post("/api/admin/dna-research-cases/:caseId/research", requireAdminAuth, async (req, res) => {
    try {
      const [row] = await db.select({ case: dnaResearchCases, pool: cigarResearchPool })
        .from(dnaResearchCases).innerJoin(cigarResearchPool, eq(cigarResearchPool.poolId, dnaResearchCases.poolId))
        .where(eq(dnaResearchCases.caseId, req.params.caseId)).limit(1);
      if (!row) return res.status(404).json({ error: "research_case_not_found" });
      if (row.case.proposedProfile) return res.status(409).json({ error: "immutable_proposal_exists" });
      const evidence = await db.select().from(cigarResearchPoolEvidence)
        .where(eq(cigarResearchPoolEvidence.poolId, row.pool.poolId)).orderBy(desc(cigarResearchPoolEvidence.rankingYear)).limit(10);
      const review = row.case.cigarId ? (await db.select().from(cigarDnaReviews)
        .where(and(eq(cigarDnaReviews.cigarId, row.case.cigarId), eq(cigarDnaReviews.status, "APPROVED"))).limit(1))[0] : null;
      const existing = currentProfile(row.case.cigarId, review?.finalProfile as Record<string, unknown> | null);
      const result = await researchCigarDna({
        poolId: row.pool.poolId, cigarId: row.case.cigarId, brand: row.pool.brand, line: row.pool.line,
        vitole: row.pool.vitole, format: row.pool.format, dimensions: row.pool.dimensions, ringGauge: row.pool.ring,
        pays: row.pool.originCountry, factory: row.pool.factory, madeBy: row.pool.madeBy,
        existingSourcingClass: row.pool.sourcingRating,
        evidenceContext: evidence.map((item) => `${item.rankingSource} ${item.rankingYear} #${item.rankingRank}`).join("; "),
      });
      const proposed = sanitizeDnaProfile(result.profile);
      if (!proposed) return res.status(502).json({ error: "research_profile_missing" });
      const memo = [result.memoResearch, result.arbitrage ? `Arbitrage : ${result.arbitrage}` : "",
        ...result.sources.map((source, index) => `${index + 1}. [${source.type}] ${source.url} — ${source.note}`)].filter(Boolean).join("\n\n");
      await db.update(dnaResearchCases).set({
        status: "RESEARCHED", caseType: existing ? "UPDATE" : "CREATE", researchMode: "AGENT",
        currentProfileSnapshot: existing, proposedProfile: proposed, finalProfile: structuredClone(proposed), memoResearch: memo,
      }).where(eq(dnaResearchCases.caseId, row.case.caseId));
      res.json({ caseId: row.case.caseId, status: "RESEARCHED", proposedProfile: proposed, finalProfile: proposed,
        currentProfile: existing, changedFields: changedDnaFields(existing, proposed) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(message === "OPENAI_API_KEY_MISSING" ? 503 : 502).json({ error: "dna_research_failed", detail: message });
    }
  });

  app.put("/api/admin/dna-research-cases/:caseId", requireAdminAuth, async (req, res) => {
    const finalProfile = sanitizeDnaProfile(req.body?.finalProfile);
    if (!finalProfile) return res.status(400).json({ error: "final_profile_required" });
    await db.update(dnaResearchCases).set({ finalProfile, memoValidation: String(req.body?.memoValidation ?? ""), status: "REVIEW" })
      .where(eq(dnaResearchCases.caseId, req.params.caseId));
    res.json({ ok: true, status: "REVIEW" });
  });

  app.post("/api/admin/dna-research-cases/:caseId/approve", requireAdminAuth, async (req, res) => {
    const [item] = await db.select().from(dnaResearchCases).where(eq(dnaResearchCases.caseId, req.params.caseId)).limit(1);
    if (!item) return res.status(404).json({ error: "research_case_not_found" });
    const finalProfile = sanitizeDnaProfile(req.body?.finalProfile ?? item.finalProfile);
    if (!finalProfile) return res.status(409).json({ error: "final_profile_required" });
    const approvedBy = String(req.body?.approvedBy ?? "admin").slice(0, 100);
    const approvedAt = new Date();
    await db.transaction(async (tx) => {
      await tx.update(dnaResearchCases).set({ status: "APPROVED", finalProfile,
        memoValidation: String(req.body?.memoValidation ?? item.memoValidation ?? ""), approvedBy, approvedAt })
        .where(eq(dnaResearchCases.caseId, item.caseId));
      if (item.cigarId) {
        await tx.insert(cigarDnaReviews).values({ cigarId: item.cigarId, status: "APPROVED",
          proposedProfile: item.proposedProfile, finalProfile, memoResearch: item.memoResearch,
          memoValidation: String(req.body?.memoValidation ?? item.memoValidation ?? ""), approvedBy, approvedAt })
          .onDuplicateKeyUpdate({ set: { status: "APPROVED", proposedProfile: item.proposedProfile,
            finalProfile, memoResearch: item.memoResearch, memoValidation: String(req.body?.memoValidation ?? item.memoValidation ?? ""),
            approvedBy, approvedAt } });
      }
    });
    res.json({ ok: true, status: "APPROVED", changedFields: changedDnaFields(
      sanitizeDnaProfile(item.currentProfileSnapshot), finalProfile,
    ) });
  });

  app.post("/api/admin/dna-research-cases/:caseId/admit", requireAdminAuth, async (_req, res) => {
    // La doctrine actuelle dit explicitement que les CIGAR_ID sont importés du
    // Master externe et ne sont jamais générés par l'application. Inventer un
    // MAX()+1 ici serait une corruption; l'API expose donc clairement le gate.
    res.status(409).json({ error: "cigar_id_allocator_unavailable",
      message: "Aucun allocateur CIGAR_ID canonique n'existe dans ce dépôt; admission suspendue sans création automatique." });
  });
}
