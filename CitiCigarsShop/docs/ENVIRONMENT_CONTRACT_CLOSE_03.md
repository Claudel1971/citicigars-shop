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
| `ANTHROPIC_API_KEY` | no | enables Anthropic-backed CRM conversation analysis; absent => NullAiProvider | yes |
| `OPENAI_API_KEY` | only when DNA Research Agent is enabled | credential used by `server/services/dna-research-agent.ts` | yes |
| `OPENAI_DNA_MODEL` | optional | model override for DNA Research Agent; code default applies when absent | no |
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

## Current RBAC bootstrap boundary

`/api/content/login` remains the existing bootstrap login and issues an expiring `OWNER` token only after `CMS_ADMIN_PASSWORD` validation. Lower-privilege roles are enforced server-side by permission middleware but CLOSE-03 does not invent a new identity store or silently provision users. Distinct operator identity provisioning remains outside this restricted CLOSE-03 scope.
