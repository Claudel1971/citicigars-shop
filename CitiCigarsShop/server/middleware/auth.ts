import type { Request, Response, NextFunction } from "express";

// CMS_ADMIN_PASSWORD is the existing variable name used across the current
// deployment (WHC/Render env). Keep this exact name to avoid breaking
// existing deployments — see brief correction #7.
//
// No hardcoded fallback: the process refuses to start if the variable is
// missing, rather than silently falling back to a known default password
// ("citicigars2024") as the previous code did.
const CMS_ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD;

if (!CMS_ADMIN_PASSWORD) {
  throw new Error(
    "CMS_ADMIN_PASSWORD must be set in the environment. Refusing to start " +
      "with no admin password configured (no hardcoded fallback is used)."
  );
}

export function getAdminPassword(): string {
  // Non-null: guarded by the throw above at module load time.
  return CMS_ADMIN_PASSWORD as string;
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    return Buffer.from(token, "base64").toString() === CMS_ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

/**
 * Express middleware enforcing admin auth on the server side.
 * Accepts the token either as `Authorization: Bearer <token>` or as the
 * `x-cms-token` header, mirroring the existing CMS auth convention.
 *
 * This must be applied to every /api/crm/* route — the frontend hiding a
 * menu item is never sufficient on its own.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cmsTokenHeader = req.headers["x-cms-token"];
  const token =
    (typeof cmsTokenHeader === "string" ? cmsTokenHeader : undefined) ||
    authHeader?.replace("Bearer ", "");

  if (!isValidAdminToken(token)) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  next();
}
