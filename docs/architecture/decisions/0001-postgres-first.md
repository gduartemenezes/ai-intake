# ADR 001 — Postgres as the only datastore

- **Status:** accepted
- **Date:** 2026-09-29
- **Deciders:** Gustavo Duarte Menezes

## Context

The system stores documents, OCR text, model output, validation results, a review queue, and an
audit log. Three of those invite a second datastore:

- Model output is a nested JSON blob whose shape will change as the prompt changes — the usual
  argument for MongoDB.
- The review queue needs workers to pull jobs without two of them taking the same one — the usual
  argument for SQS or Redis.
- Audit events are append-only and high-volume — the usual argument for a log store.

Adding any of them means a second consistency model, a second failure mode, a second thing to run
locally, and a second thing to explain.

## Decision

Postgres holds everything in v0: relational entities, JSON payloads, the job queue, and the audit
log. No MongoDB, no Redis, no external queue until a measured limit forces it.

## Rationale

**JSONB covers the schemaless case.** `jsonb` stores the raw model response verbatim and can be
queried and indexed with GIN. The fields the system actually depends on — supplier, total, date —
are promoted to typed columns with constraints. The parts that drift stay in `jsonb`. That split
is the point: the stable shape gets checked by the database, the unstable shape stays flexible.

**`SELECT … FOR UPDATE SKIP LOCKED` is a real queue.** A row-locking claim is transactional, so a
worker crash rolls the job back automatically, and enqueueing a job commits in the same
transaction as the state change that caused it — no outbox, no dual-write window. Postgres is
comfortable into the thousands of jobs per second, which is several orders of magnitude past this
workload.

**One transaction boundary.** Approving a case updates the case, closes the review task, and
appends the audit event. In one database that is one atomic commit. Split across two stores it
becomes a distributed write with a partial-failure path and a reconciliation job.

**Constraints catch bugs that tests miss.** Foreign keys, `CHECK`, and unique indexes reject
invalid states at the boundary, including from a buggy migration or a manual query.

**Learning value.** Doing queueing, concurrency, and JSON in Postgres means confronting MVCC,
isolation levels, lock contention, and index behavior directly, rather than delegating them to a
managed service. That is an explicit goal of this project.

## Consequences

**Accepted costs**

- Queue throughput ceiling. Fine now; a hot `SKIP LOCKED` table under heavy contention eventually
  needs partitioning or a real broker.
- The audit table grows without bound and will need partitioning by month.
- `jsonb` is easy to abuse. Rule: anything queried in a `WHERE` clause on a hot path gets promoted
  to a column.
- No cross-region fan-out; irrelevant at this scale.

**Revisit when**

- Job claim latency p95 exceeds 500ms under normal load, **or**
- More than one service needs to consume the same events, **or**
- Audit volume exceeds what partitioning handles comfortably.

SQS is planned for week 11 — not because Postgres runs out, but to demonstrate the migration path
and make the trade-off concrete by having built both.

## Alternatives considered

- **Postgres + MongoDB.** Rejected: `jsonb` already covers the flexible-schema need, and the cost
  is two consistency models.
- **Postgres + Redis for the queue.** Rejected: Redis-as-queue needs its own delivery guarantees
  and reintroduces dual-write between the job and the state change.
- **Postgres + SQS from day one.** Deferred: correct at scale, but it hides the concurrency
  problems this project exists to learn.
