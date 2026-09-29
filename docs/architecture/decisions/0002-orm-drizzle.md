# ADR 002 — Drizzle as the ORM

- **Status:** accepted
- **Date:** 2026-09-29
- **Deciders:** Gustavo Duarte Menezes

## Context

ADR 001 puts the queue, the audit log, and the JSON payloads in Postgres. That makes the data
layer load-bearing: the code needs row locking (`FOR UPDATE SKIP LOCKED`), explicit transaction
boundaries spanning several repositories, `jsonb` operators, and `EXPLAIN ANALYZE` on queries it
actually emits.

Two candidates: Prisma and Drizzle. Both are production-viable with NestJS and Postgres; this is
a trade-off, not a correctness question.

## Decision

Drizzle ORM, with `drizzle-kit` for migrations and `node-postgres` as the driver.

## Rationale

**The generated SQL is readable and predictable.** A Drizzle query is close enough to SQL that the
statement it produces can be predicted from the code. Since a stated goal of this project is
getting fluent with query plans and index behavior, an opaque query layer is a real obstacle —
optimizing a query means knowing what was sent.

**Locking is first-class.** `.for('update', { skipLocked: true })` is part of the query builder.
In Prisma the same thing requires dropping to `$queryRaw`, which loses type safety exactly where
correctness matters most. The queue is the heart of ADR 001, so the ORM should not be fighting it.

**Transactions compose across repositories.** `db.transaction(async (tx) => …)` passes `tx` down;
each repository takes the connection as an argument. Updating a case, closing a review task, and
appending an audit event happen in one commit with no ambient state.

**Migrations are SQL files.** `drizzle-kit generate` emits plain `.sql` that is reviewed before it
runs. On a table that will hold hundreds of thousands of audit rows, knowing whether a migration
takes a lock matters more than the convenience of an automatic one.

**No separate engine or code-generation step.** Drizzle is a TypeScript library: schema is
TypeScript, types are inferred, `pnpm install` is the whole setup. Prisma's Rust query engine is a
binary that ships per-platform and needs `prisma generate` after every schema edit — workable, but
more moving parts in CI and Docker.

## Consequences

**Accepted costs**

- Smaller ecosystem and fewer answers when something breaks. Prisma's documentation and community
  are considerably larger.
- No equivalent of Prisma Studio. Mitigated by `psql` and any Postgres GUI — and reading the data
  in SQL is the point.
- More verbose relational queries: joins are explicit rather than a nested `include`.
- Drizzle's API still moves faster than Prisma's; minor versions occasionally shift.

**Revisit when**

- The team grows beyond one developer and onboarding cost outweighs SQL transparency, **or**
- A schema-introspection or admin-UI need appears that Drizzle cannot serve.

The repository layer sits behind interfaces in the domain modules, so swapping the ORM is a
bounded change — not a rewrite.

## Alternatives considered

- **Prisma.** Better ergonomics, larger ecosystem, best-in-class DX for CRUD. Rejected because
  `SKIP LOCKED` and hand-tuned queries fall back to raw SQL, which is precisely the load-bearing
  part of this system.
- **TypeORM.** Rejected: the NestJS-default option, but decorator-driven entities, historically
  rough migration generation, and a checkered maintenance record.
- **Raw `pg` + hand-written SQL.** Tempting for learning, rejected for practical reasons: no
  compile-time link between query results and TypeScript types, and hand-rolled migrations. Drizzle
  keeps the SQL visible while typing the results.
