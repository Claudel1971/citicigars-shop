import { z } from "zod";
const realDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Date invalide",
  );
export const taskInput = z
  .object({
    customerId: z.string().min(1).max(36),
    category: z.enum([
      "CONTACT_VERIFICATION",
      "ADMIN_DOCUMENT",
      "ACCOUNT_RECONCILIATION",
    ]),
    dueAt: realDate,
    responsible: z.string().trim().min(1).max(100),
  })
  .strict();
export const taskTransition = z
  .object({
    status: z.enum(["OPEN", "DONE", "CANCELLED"]),
    version: z.number().int().positive(),
  })
  .strict();
export const factualFields = z
  .object({
    origin: z.string().max(500),
    wrapper: z.string().max(500),
    binder: z.string().max(500),
    filler: z.string().max(1000),
    format: z.string().max(100),
    dimensions: z.string().max(100),
  })
  .strict();
export const sheetInput = z
  .object({
    cigarId: z.string().min(1).max(20),
    source: z.string().trim().min(1).max(500),
    sourceDate: realDate.nullable(),
    originalText: z.string().min(1).max(50000),
    fields: factualFields,
  })
  .strict();
// Extract only factual source labels. No recommendation, tasting or promotion generation.
export function parseInternalSheet(text: string) {
  const field = (labels: string) =>
    text
      .match(
        new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*[:：]\\s*([^\\n]+)`, "i"),
      )?.[1]
      .trim() ?? "";
  return {
    origin: field("Origine|Pays"),
    wrapper: field("Cape"),
    binder: field("Sous-cape|Sous cape"),
    filler: field("Tripe"),
    format: field("Format"),
    dimensions: field("Dimensions?"),
  };
}
export function nextBusinessCode(kind: "CUST" | "SUPP", sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 999999)
    throw new Error("Séquence métier épuisée");
  return `CTCG-${kind}-${String(sequence).padStart(6, "0")}`;
}
