import type { Express, Request, Response } from "express";
import { and, eq, like, or } from "drizzle-orm";
import { db } from "./db.mysql";
import { requireAdminAuth } from "./middleware/auth";
import {
  cigarCatalog,
  cigarDnaReviews,
  cigarDnaReviewStatusValues,
} from "../shared/schema.stock";

const DNA_PROFILE_FIELDS = [
  "vitole",
  "dimensions",
  "sourcingClass",
  "puissance",
  "famille1",
  "famille2",
  "famille3",
  "intensite",
  "spice",
  "sweet",
  "signatures",
  "dureeMin",
  "dureeMax",
  "confidence",
] as const;

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

export function registerDnaResearchRoutes(app: Express): void {
  app.get(
    "/api/admin/dna-research",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const status = typeof req.query.status === "string" ? req.query.status : "";
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

        const conditions = [];

        if (status && isValidStatus(status)) {
          conditions.push(eq(cigarDnaReviews.status, status));
        }

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

        const rows =
          conditions.length > 0
            ? await baseQuery.where(and(...conditions))
            : await baseQuery;

        res.json({
          count: rows.length,
          profileFields: DNA_PROFILE_FIELDS,
          rows: rows.map((row) => ({
            ...row,
            status: row.status ?? "DRAFT",
          })),
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

        res.json({
          ...rows[0],
          status: rows[0].status ?? "DRAFT",
          profileFields: DNA_PROFILE_FIELDS,
        });
      } catch (error) {
        console.error("DNA research detail error:", error);
        res.status(500).json({ error: "dna_research_detail_failed" });
      }
    },
  );

  app.put(
    "/api/admin/dna-research/:cigarId",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const cigarId = req.params.cigarId.trim();

        const cigar = await db
          .select({ cigarId: cigarCatalog.cigarId })
          .from(cigarCatalog)
          .where(eq(cigarCatalog.cigarId, cigarId))
          .limit(1);

        if (!cigar.length) {
          return res.status(404).json({ error: "cigar_not_found" });
        }

        const proposedProfile = sanitizeProfile(req.body?.proposedProfile);
        const finalProfile = sanitizeProfile(req.body?.finalProfile);

        const requestedStatus = req.body?.status;
        if (requestedStatus !== undefined && !isValidStatus(requestedStatus)) {
          return res.status(400).json({ error: "invalid_status" });
        }

        const status =
          requestedStatus ??
          (proposedProfile ? "RESEARCHED" : "DRAFT");

        const values = {
          cigarId,
          status,
          proposedProfile,
          finalProfile,
          memoResearch:
            typeof req.body?.memoResearch === "string"
              ? req.body.memoResearch
              : null,
          memoValidation:
            typeof req.body?.memoValidation === "string"
              ? req.body.memoValidation
              : null,
        };

        await db
          .insert(cigarDnaReviews)
          .values(values)
          .onDuplicateKeyUpdate({
            set: {
              status: values.status,
              proposedProfile: values.proposedProfile,
              finalProfile: values.finalProfile,
              memoResearch: values.memoResearch,
              memoValidation: values.memoValidation,
            },
          });

        res.json({ success: true, cigarId, status });
      } catch (error: any) {
        if (error instanceof Error && error.message === "INVALID_PROFILE") {
          return res.status(400).json({ error: "invalid_profile" });
        }

        console.error("DNA research save error:", error);
        res.status(500).json({ error: "dna_research_save_failed" });
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
