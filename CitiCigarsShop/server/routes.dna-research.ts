import type { Express, Request, Response } from "express";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "./db.mysql";
import { requireAdminAuth } from "./middleware/auth";
import { researchCigarDna } from "./services/dna-research-agent";
import {
  cigarCatalog,
  cigarDnaReviews,
  cigarDnaReviewStatusValues,
} from "../shared/schema.stock";
import { DNA_PROFILE_FIELDS } from "../shared/dna-profile";

const dnaReference = require("../shared/data/sourcing-pool-top25-v4.json") as {
  candidates: Array<Record<string, unknown> & { cigarId: string }>;
};

function isValidStatus(value: unknown): value is typeof cigarDnaReviewStatusValues[number] {
  return (
    typeof value === "string" &&
    (cigarDnaReviewStatusValues as readonly string[]).includes(value)
  );
}

function sanitizeProfile(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_PROFILE");
  }

  const source = value as Record<string, unknown>;
  const profile: Record<string, unknown> = {};

  for (const field of DNA_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      profile[field] = source[field];
    }
  }

  return profile;
}

function referenceProfile(
  candidate: Record<string, unknown>,
): Record<string, unknown> {
  return (
    sanitizeProfile({
      ...candidate,
      brand: candidate.brand,
      line: candidate.line,
      dimensions: candidate.dimensions ?? candidate.dimension,
    }) ?? {}
  );
}

const DNA_REFERENCE_BY_ID = new Map(
  dnaReference.candidates.map((candidate) => [
    candidate.cigarId,
    referenceProfile(candidate),
  ]),
);
const SOURCING_REFERENCE_BY_ID = new Map(
  dnaReference.candidates.map((candidate) => [
    candidate.cigarId,
    typeof candidate.sourcingClass === "string" ? candidate.sourcingClass : null,
  ]),
);

export function registerDnaResearchRoutes(app: Express): void {
  app.get(
    "/api/admin/dna-research",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const filter =
          typeof req.query.status === "string" ? req.query.status : "";
        const q =
          typeof req.query.q === "string" ? req.query.q.trim() : "";

        const conditions = [];

        if (q) {
          const pattern = `%${q}%`;
          conditions.push(
            or(
              like(cigarCatalog.cigarId, pattern),
              like(cigarCatalog.marque, pattern),
              like(cigarCatalog.ligne, pattern),
              like(cigarCatalog.vitole, pattern),
            )!,
          );
        }

        const baseQuery = db
          .select({
            cigarId: cigarCatalog.cigarId,
            marque: cigarCatalog.marque,
            ligne: cigarCatalog.ligne,
            vitole: cigarCatalog.vitole,
            format: cigarCatalog.format,
            dimensions: cigarCatalog.dimensions,
            ringGauge: cigarCatalog.ringGauge,
            pays: cigarCatalog.pays,
            sourceRef: cigarCatalog.sourceRef,

            status: cigarDnaReviews.status,
            proposedProfile: cigarDnaReviews.proposedProfile,
            finalProfile: cigarDnaReviews.finalProfile,
            memoResearch: cigarDnaReviews.memoResearch,
            memoValidation: cigarDnaReviews.memoValidation,
            approvedBy: cigarDnaReviews.approvedBy,
            approvedAt: cigarDnaReviews.approvedAt,
            updatedAt: cigarDnaReviews.updatedAt,
          })
          .from(cigarCatalog)
          .leftJoin(
            cigarDnaReviews,
            eq(cigarCatalog.cigarId, cigarDnaReviews.cigarId),
          );

        const dbRows =
          conditions.length > 0
            ? await baseQuery.where(and(...conditions))
            : await baseQuery;

        const enriched = dbRows.map((row) => {
          const baselineProfile =
            DNA_REFERENCE_BY_ID.get(row.cigarId) ?? null;

          const approvedProfile =
            row.status === "APPROVED"
              ? ((row.finalProfile as Record<string, unknown> | null) ?? null)
              : null;

          const hasExistingDna = Boolean(
            baselineProfile || approvedProfile,
          );

          const effectiveStatus =
            row.status ??
            (hasExistingDna ? "PROFILED" : "DRAFT");

          return {
            ...row,
            status: effectiveStatus,
            hasExistingDna,
            baselineProfile,
            currentProfile: approvedProfile ?? baselineProfile,
            sourcingRating: SOURCING_REFERENCE_BY_ID.get(row.cigarId) ?? null,
          };
        });

        const rows = enriched.filter((row) => {
          if (!filter) return true;

          if (filter === "UNPROFILED" || filter === "DRAFT") {
            return row.status === "DRAFT";
          }

          if (filter === "PROFILED") {
            return row.hasExistingDna;
          }

          if (isValidStatus(filter)) {
            return row.status === filter;
          }

          return true;
        });

        res.json({
          count: rows.length,
          totalCatalog: enriched.length,
          referenceDnaCount: DNA_REFERENCE_BY_ID.size,
          profileFields: DNA_PROFILE_FIELDS,
          rows,
        });
      } catch (error) {
        console.error("DNA research list error:", error);
        res.status(500).json({ error: "dna_research_list_failed" });
      }
    },
  );

  app.get(
    "/api/admin/dna-research/:cigarId",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const cigarId = req.params.cigarId.trim();

        const rows = await db
          .select({
            cigarId: cigarCatalog.cigarId,
            marque: cigarCatalog.marque,
            ligne: cigarCatalog.ligne,
            vitole: cigarCatalog.vitole,
            format: cigarCatalog.format,
            dimensions: cigarCatalog.dimensions,
            ringGauge: cigarCatalog.ringGauge,
            pays: cigarCatalog.pays,
            sourceRef: cigarCatalog.sourceRef,

            status: cigarDnaReviews.status,
            proposedProfile: cigarDnaReviews.proposedProfile,
            finalProfile: cigarDnaReviews.finalProfile,
            memoResearch: cigarDnaReviews.memoResearch,
            memoValidation: cigarDnaReviews.memoValidation,
            approvedBy: cigarDnaReviews.approvedBy,
            approvedAt: cigarDnaReviews.approvedAt,
            updatedAt: cigarDnaReviews.updatedAt,
          })
          .from(cigarCatalog)
          .leftJoin(
            cigarDnaReviews,
            eq(cigarCatalog.cigarId, cigarDnaReviews.cigarId),
          )
          .where(eq(cigarCatalog.cigarId, cigarId))
          .limit(1);

        if (!rows.length) {
          return res.status(404).json({ error: "cigar_not_found" });
        }

        const row = rows[0];
        const baselineProfile =
          DNA_REFERENCE_BY_ID.get(cigarId) ?? null;

        const approvedProfile =
          row.status === "APPROVED"
            ? ((row.finalProfile as Record<string, unknown> | null) ?? null)
            : null;

        const hasExistingDna = Boolean(
          baselineProfile || approvedProfile,
        );

        res.json({
          ...row,
          status:
            row.status ??
            (hasExistingDna ? "PROFILED" : "DRAFT"),
          hasExistingDna,
          baselineProfile,
          currentProfile: approvedProfile ?? baselineProfile,
          sourcingRating: SOURCING_REFERENCE_BY_ID.get(cigarId) ?? null,
          profileFields: DNA_PROFILE_FIELDS,
        });
      } catch (error) {
        console.error("DNA research detail error:", error);
        res.status(500).json({ error: "dna_research_detail_failed" });
      }
    },
  );

  app.post(
    "/api/admin/dna-research/:cigarId/research",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const cigarId = req.params.cigarId.trim();

        const cigars = await db
          .select({
            cigarId: cigarCatalog.cigarId,
            marque: cigarCatalog.marque,
            ligne: cigarCatalog.ligne,
            vitole: cigarCatalog.vitole,
            format: cigarCatalog.format,
            dimensions: cigarCatalog.dimensions,
            ringGauge: cigarCatalog.ringGauge,
            pays: cigarCatalog.pays,
            sourceRef: cigarCatalog.sourceRef,
          })
          .from(cigarCatalog)
          .where(eq(cigarCatalog.cigarId, cigarId))
          .limit(1);

        if (!cigars.length) {
          return res.status(404).json({ error: "cigar_not_found" });
        }

        const existingRows = await db
          .select()
          .from(cigarDnaReviews)
          .where(eq(cigarDnaReviews.cigarId, cigarId))
          .limit(1);

        const existing = existingRows[0];

        if (
          existing?.status === "APPROVED" ||
          existing?.status === "RESEARCHED"
        ) {
          return res.status(409).json({
            error: "research_already_completed",
            status: existing.status,
          });
        }

        const existingProfile =
          (existing?.finalProfile as Record<string, unknown> | null) ??
          (existing?.proposedProfile as Record<string, unknown> | null) ??
          DNA_REFERENCE_BY_ID.get(cigarId) ??
          null;

        const result = await researchCigarDna({
          ...cigars[0],
          existingSourcingClass:
            SOURCING_REFERENCE_BY_ID.get(cigarId) ?? null,
        });

        const proposedProfile = sanitizeProfile(result.profile);
        if (!proposedProfile) {
          return res.status(502).json({ error: "research_profile_missing" });
        }

        // IMPORTANT: the human-review column starts as an exact snapshot
        // of the agent proposal. Later human edits affect final_profile only.
        const finalProfile = structuredClone(proposedProfile);

        const sourceLines = result.sources.map(
          (source, index) =>
            `${index + 1}. [${source.type}] ${source.url} — ${source.note}`,
        );

        const memoResearch = [
          result.memoResearch.trim(),
          result.arbitrage.trim()
            ? `Arbitrage : ${result.arbitrage.trim()}`
            : "",
          sourceLines.length
            ? `Sources :\n${sourceLines.join("\n")}`
            : "Sources : aucune source retournée",
        ]
          .filter(Boolean)
          .join("\n\n");

        await db
          .insert(cigarDnaReviews)
          .values({
            cigarId,
            status: "RESEARCHED",
            proposedProfile,
            finalProfile,
            memoResearch,
            memoValidation: existing?.memoValidation ?? null,
            approvedBy: null,
            approvedAt: null,
          })
          .onDuplicateKeyUpdate({
            set: {
              status: "RESEARCHED",
              proposedProfile,
              finalProfile,
              memoResearch,
              approvedBy: null,
              approvedAt: null,
            },
          });

        res.json({
          success: true,
          cigarId,
          status: "RESEARCHED",
          proposedProfile,
          finalProfile,
          memoResearch,
        });
      } catch (error: any) {
        if (error instanceof Error && error.message === "OPENAI_API_KEY_MISSING") {
          return res.status(503).json({ error: "openai_api_key_missing" });
        }

        console.error("DNA research agent error:", error);
        res.status(502).json({
          error: "dna_research_agent_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.put(
    "/api/admin/dna-research/:cigarId",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const cigarId = req.params.cigarId.trim();

        const cigars = await db
          .select({ cigarId: cigarCatalog.cigarId })
          .from(cigarCatalog)
          .where(eq(cigarCatalog.cigarId, cigarId))
          .limit(1);

        if (!cigars.length) {
          return res.status(404).json({ error: "cigar_not_found" });
        }

        const existingRows = await db
          .select()
          .from(cigarDnaReviews)
          .where(eq(cigarDnaReviews.cigarId, cigarId))
          .limit(1);

        const existing = existingRows[0];

        if (existing?.status === "APPROVED") {
          return res.status(409).json({ error: "approved_profile_locked" });
        }

        const finalProfile = Object.prototype.hasOwnProperty.call(
          req.body ?? {},
          "finalProfile",
        )
          ? sanitizeProfile(req.body?.finalProfile)
          : ((existing?.finalProfile as Record<string, unknown> | null) ?? null);

        const memoValidation =
          typeof req.body?.memoValidation === "string"
            ? req.body.memoValidation
            : (existing?.memoValidation ?? null);

        // Agent evidence is immutable from the human-edit endpoint.
        // Only the /research endpoint may create proposed_profile/memo_research.
        const proposedProfile =
          (existing?.proposedProfile as Record<string, unknown> | null) ?? null;
        const memoResearch = existing?.memoResearch ?? null;

        const hasBaselineProfile = DNA_REFERENCE_BY_ID.has(cigarId);

        const status =
          existing?.status ??
          (proposedProfile
            ? "RESEARCHED"
            : hasBaselineProfile
              ? "REVIEW"
              : "DRAFT");

        await db
          .insert(cigarDnaReviews)
          .values({
            cigarId,
            status,
            proposedProfile,
            finalProfile,
            memoResearch,
            memoValidation,
          })
          .onDuplicateKeyUpdate({
            set: {
              finalProfile,
              memoValidation,
            },
          });

        res.json({
          success: true,
          cigarId,
          status,
          proposedProfile,
          finalProfile,
          memoResearch,
          memoValidation,
        });
      } catch (error) {
        console.error("DNA review save error:", error);
        res.status(500).json({ error: "dna_review_save_failed" });
      }
    },
  );

  app.post(
    "/api/admin/dna-research/:cigarId/approve",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const cigarId = req.params.cigarId.trim();

        const rows = await db
          .select()
          .from(cigarDnaReviews)
          .where(eq(cigarDnaReviews.cigarId, cigarId))
          .limit(1);

        if (!rows.length) {
          return res.status(404).json({ error: "dna_review_not_found" });
        }

        const existing = rows[0];
        const finalProfile =
          sanitizeProfile(req.body?.finalProfile) ??
          (existing.finalProfile as Record<string, unknown> | null) ??
          (existing.proposedProfile as Record<string, unknown> | null);

        if (!finalProfile) {
          return res.status(400).json({ error: "profile_required" });
        }

        const approvedBy =
          typeof req.body?.approvedBy === "string" &&
          req.body.approvedBy.trim()
            ? req.body.approvedBy.trim()
            : "Admin";

        const memoValidation =
          typeof req.body?.memoValidation === "string"
            ? req.body.memoValidation
            : existing.memoValidation;

        await db
          .update(cigarDnaReviews)
          .set({
            status: "APPROVED",
            finalProfile,
            memoValidation,
            approvedBy,
            approvedAt: new Date(),
          })
          .where(eq(cigarDnaReviews.cigarId, cigarId));

        res.json({
          success: true,
          cigarId,
          status: "APPROVED",
          approvedBy,
        });
      } catch (error: any) {
        if (error instanceof Error && error.message === "INVALID_PROFILE") {
          return res.status(400).json({ error: "invalid_profile" });
        }

        console.error("DNA research approval error:", error);
        res.status(500).json({ error: "dna_research_approval_failed" });
      }
    },
  );
}
