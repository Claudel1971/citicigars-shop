# CitiCigars Commerce OS — Environment Contract

**Scope:** CLOSE-03 security / environment hygiene only.  
**Branch:** `replit-commerce-os-v2`  
**Rule:** no secret values belong in Git.

## Canonical database convention

- `MYSQL_URL` — **canonical runtime database URL for CitiCigars Commerce OS**. Used by `server/db.mysql.ts` and by `drizzle.config.mysql.ts`.
- `DATABASE_URL` — retained only for the historical PostgreSQL path (`server/db.postgres.ts`, `drizzle.config.ts`) and tooling that explicitly targets PostgreSQL. It is not the canonical MySQL runtime variable.

This separation removes the former ambiguity where the application runtime used `MYSQL_URL` while the MySQL Drizzle configuration expected `DATABASE_URL`.

## Environment variables

| Variable | Required | Purpose | Secret |
|---|---|---|---|
| `MYSQL_URL` | yes for the current Commerce OS runtime | canonical MySQL connection string | yes |
| `DATABASE_URL` | only when the historical PostgreSQL path/tooling is invoked | PostgreSQL connection string | yes |
| `CMS_ADMIN_PASSWORD` | yes | bootstrap credential and server-side key material for expiring admin tokens | yes |
| `ANTHROPIC_API_KEY` | no | enables AI-backed conversation analysis; absent => NullAiProvider | yes |
| `PORT` | platform/default | HTTP listener port | no |
| `NODE_ENV` | platform/default | runtime mode | no |
| `BASE_PATH` | optional | CitiCigarsAdmin Vite base path | no |
| `CLOUDINARY_URL` | only for Cloudinary migration/media tooling | Cloudinary connection configuration | yes |

## Hygiene rules

1. Values are supplied by the runtime/platform environment, never committed.
2. `CMS_ADMIN_PASSWORD` has no hardcoded fallback. Startup must fail closed when it is missing.
3. Admin tokens are signed and expiring; the bootstrap password itself is never embedded in a token.
4. Replit-only variables (`REPL_ID`, `REPLIT_INTERNAL_APP_DOMAIN`) are optional development compatibility signals and are not part of the production secret contract.
5. No deployment, database migration, or secret rotation is performed by this CLOSE-03 change.
