# Verification — run these on your machine

The sandbox that generated this repo had no access to the npm registry or a Docker daemon, so
nothing below has been executed. Treat it as the first thing to do, not as a formality: this is
the "it runs with one command" criterion from week 1.

## 1. Install and pin

```bash
cp .env.example .env
pnpm install
```

The versions in `apps/api/package.json` were written by hand rather than resolved by pnpm.
Check them once:

```bash
pnpm outdated -r
```

Two to look at specifically:

- **`zod`** is pinned to `^3.25` on purpose. Zod 4 renames the string-format validators
  (`z.string().url()` becomes `z.url()`), so `src/config/env.ts` needs an edit before upgrading.
- **`@nestjs/terminus`** must be v11 or newer. `src/health/database.health.ts` uses
  `HealthIndicatorService`, which replaced the older `HealthIndicator` base class.

## 2. Database and migration

```bash
pnpm db:up
docker compose ps          # postgres should read "healthy"
pnpm db:generate           # writes apps/api/drizzle/0000_*.sql
```

Read the generated SQL before applying it — that habit is the whole argument in ADR 002.

```bash
pnpm db:migrate
psql postgresql://intake:intake@localhost:5432/intake -c '\d documents'
```

Commit the generated migration.

## 3. Boot and probe

```bash
pnpm dev
```

In another terminal:

```bash
curl -i localhost:3000/health/live   # 200
curl -i localhost:3000/health        # 200, database "up", responseTimeMs present
```

## 4. Prove the check is real

A healthcheck that cannot fail is decoration. Verify it fails correctly:

```bash
docker compose stop postgres
curl -i localhost:3000/health        # expect 503, database "down" with a message
docker compose start postgres
curl -i localhost:3000/health        # expect 200 again
```

If step 4 returns 200 while Postgres is stopped, the check is not reaching the database and the
day is not done.

## 5. Quality gates

```bash
pnpm typecheck
pnpm lint
pnpm test        # 6 assertions on env validation
pnpm build
```

## 6. Push and confirm CI

```bash
git init && git add -A
git commit -m "Set up monorepo, API skeleton, and Postgres healthcheck"
gh repo create ai-intake --public --source=. --push
```

Then open the Actions tab. The workflow runs typecheck, lint, test, build, migrate, and finally
boots the API against a Postgres service container and curls `/health`. Green CI is the week-1
criterion.

## Known gaps, by design

- No `pnpm-lock.yaml` yet — it appears on your first install and must be committed, since CI runs
  `--frozen-lockfile`.
- No migration files yet — `pnpm db:generate` creates the first one.
- `apps/web` does not exist. Frontend starts in week 9.
