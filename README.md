# Intake

AI-assisted intake for invoices and receipts, built around the part that usually gets skipped:
knowing when the extraction is wrong.

A document arrives, gets OCR'd, an LLM proposes structured fields, deterministic rules check
that proposal, and anything doubtful goes to a human review queue with a stated reason. Every
transition is written to an append-only audit log.

- **Product scope:** [`docs/product/prd.md`](docs/product/prd.md)
- **Why one datastore:** [`ADR 001 — Postgres-first`](docs/architecture/decisions/0001-postgres-first.md)
- **Why Drizzle:** [`ADR 002 — ORM choice`](docs/architecture/decisions/0002-orm-drizzle.md)

## Status

Week 1 of 12. The skeleton runs: config validation, a pooled Postgres connection, and a
readiness check that issues a real query. Domain model and pipeline land in the following weeks.

## Stack

TypeScript · NestJS 11 · PostgreSQL 17 · Drizzle ORM · Zod · Jest · Docker Compose ·
GitHub Actions

## Running it

Requires Node 22+, pnpm 10+, and Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up          # Postgres on :5432
pnpm db:generate    # first run only — emits the initial migration SQL
pnpm db:migrate
pnpm dev            # API on :3000
```

Then:

```bash
curl localhost:3000/health/live   # liveness — process is up
curl localhost:3000/health        # readiness — runs `select 1` against Postgres
```

Readiness returns HTTP 503 when the database is unreachable. Worth confirming once:

```bash
docker compose stop postgres
curl -i localhost:3000/health     # expect 503
docker compose start postgres
```

## Layout

```
apps/api/            NestJS service
  src/config/        environment schema, validated at boot
  src/db/            Drizzle schema, pool, module
  src/health/        liveness and readiness
docs/product/        PRD
docs/architecture/   decision records
```

## Conventions

- Migrations are reviewed SQL, generated with `pnpm db:generate` and committed.
- Anything queried in a `WHERE` clause on a hot path is a column, not a `jsonb` key.
- Decisions with a trade-off get an ADR. Decisions with an obvious answer do not.
