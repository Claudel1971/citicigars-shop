import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const CMS_ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD;

if (!CMS_ADMIN_PASSWORD) {
  throw new Error(
    "CMS_ADMIN_PASSWORD must be set in the environment. Refusing to start " +
      "with no admin password configured (no hardcoded fallback is used)."
  );
}

const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const TOKEN_CLOCK_SKEW_SECONDS = 30;
const TOKEN_SIGNING_KEY = crypto
  .createHash("sha256")
  .update("citicigars-admin-token-v1\0")
  .update(CMS_ADMIN_PASSWORD)
  .digest();

export type AdminPermission =
  | "crm:read"
  | "crm:write"
  | "stock:read"
  | "stock:write"
  | "purchasing:read"
  | "purchasing:write"
  | "approvals:read"
  | "approvals:decide"
  | "governance:read"
  | "governance:write"
  | "content:read"
  | "content:write"
  | "product:read"
  | "product:write";

export type AdminRole =
  | "OWNER"
  | "ADMIN"
  | "CRM_OPERATOR"
  | "STOCK_OPERATOR"
  | "PURCHASING_OPERATOR"
  | "APPROVER"
  | "AUDITOR"
  | "CONTENT_EDITOR";

const ROLE_PERMISSIONS: Record<AdminRole, readonly (AdminPermission | "*")[]> = {
  OWNER: ["*"],
  ADMIN: [
    "crm:read", "crm:write",
    "stock:read", "stock:write",
    "purchasing:read", "purchasing:write",
    "approvals:read", "approvals:decide",
    "governance:read",
    "content:read", "content:write",
    "product:read", "product:write",
  ],
  CRM_OPERATOR: ["crm:read", "crm:write", "stock:read", "product:read"],
  STOCK_OPERATOR: ["stock:read", "stock:write", "product:read"],
  PURCHASING_OPERATOR: ["purchasing:read", "purchasing:write", "stock:read", "product:read"],
  APPROVER: ["approvals:read", "approvals:decide", "governance:read"],
  AUDITOR: ["crm:read", "stock:read", "purchasing:read", "approvals:read", "governance:read", "content:read", "product:read"],
  CONTENT_EDITOR: ["content:read", "content:write", "product:read"],
};

type AdminTokenPayload = {
  v: number;
  sub: "cms-admin";
  role: AdminRole;
  iat: number;
  exp: number;
  nonce: string;
};

declare module "express-serve-static-core" {
  interface Request {
    adminAuth?: AdminTokenPayload;
  }
}

export function getAdminPassword(): string {
  return CMS_ADMIN_PASSWORD as string;
}

function encodePayload(payload: AdminTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", TOKEN_SIGNING_KEY).update(encodedPayload).digest("base64url");
}

function getPresentedToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const cmsTokenHeader = req.headers["x-cms-token"];
  return (
    (typeof cmsTokenHeader === "string" ? cmsTokenHeader : undefined) ||
    authHeader?.replace(/^Bearer\s+/i, "")
  );
}

export function issueAdminToken(role: AdminRole = "OWNER"): { token: string; expiresInSeconds: number } {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    v: TOKEN_VERSION,
    sub: "cms-admin",
    role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const encodedPayload = encodePayload(payload);
  return {
    token: `${encodedPayload}.${sign(encodedPayload)}`,
    expiresInSeconds: TOKEN_TTL_SECONDS,
  };
}

export function verifyAdminToken(token: string | undefined | null): AdminTokenPayload | null {
  if (!token) return null;
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;

  const expected = sign(encodedPayload);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload?.v !== TOKEN_VERSION ||
    payload?.sub !== "cms-admin" ||
    !Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, payload?.role) ||
    !Number.isInteger(payload?.iat) ||
    !Number.isInteger(payload?.exp) ||
    typeof payload?.nonce !== "string" ||
    payload.nonce.length < 16 ||
    payload.iat > now + TOKEN_CLOCK_SKEW_SECONDS ||
    payload.exp <= now ||
    payload.exp - payload.iat > TOKEN_TTL_SECONDS + TOKEN_CLOCK_SKEW_SECONDS
  ) {
    return null;
  }

  return payload;
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  return verifyAdminToken(token) !== null;
}

function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const payload = verifyAdminToken(getPresentedToken(req));
  if (!payload) return res.status(401).json({ error: "Non autorisé" });
  req.adminAuth = payload;
  next();
}

export function requirePermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = verifyAdminToken(getPresentedToken(req));
    if (!payload) return res.status(401).json({ error: "Non autorisé" });
    if (!roleHasPermission(payload.role, permission)) {
      return res.status(403).json({ error: "Permission insuffisante", permission });
    }
    req.adminAuth = payload;
    next();
  };
}
