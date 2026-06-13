# CLAUDE.md

## Project context
Learning project — see `PROJECT_PLAN.md` for the full roadmap, tech stack, target structure, and Prisma schema.

## How to work on this project
- This is a learning project for the user (Docker, auth, caching). Explain *why* something is structured the way it is, not just *what* to write.
- Go step by step at the user's pace — don't jump ahead to later steps.
- Pair on conceptually new pieces (offer to explain + let the user write, or walk through together). Mechanical/repetitive parts (e.g. wiring a new endpoint following an existing pattern) can be left to the user to try first.

## Current status
- **Step 1 (CRUD)** — done. `LinksModule`: `POST/GET /links`, `GET /links/:code`, `DELETE /links/:id`.
- **Step 2 (Auth)** — done:
  - `POST /auth/register`, `POST /auth/login` — login returns `{ accessToken }` in the body and sets a `refreshToken` as an `httpOnly` cookie (also stored in the `RefreshToken` table)
  - `JwtStrategy` + `JwtAuthGuard` — protecting `POST /links` (`req.user.userId` replaces the old hardcoded `'anonymous'`)
  - `POST /auth/refresh` — verifies the refresh JWT (`JWT_REFRESH_SECRET`) + checks the DB row, then rotates: deletes the old `RefreshToken` row and issues a new access/refresh pair
  - `POST /auth/logout` — deletes the `RefreshToken` row and clears the cookie
  - **Possible future improvement (deferred, not started)**: refresh token reuse detection — instead of `delete` on rotation, soft-delete/flag rows as `revoked`. If a `revoked` token is ever presented again (signal of theft), revoke *all* refresh tokens for that user, forcing re-login everywhere. Should be addable later without reworking the current flow (just changes what `refresh()` does with the old row + adds a check).
- **Docker stack** — `docker compose up -d --build` works end to end (db healthy, cache, app on `localhost:3000`).
- **Step 3 (Redis cache)** — done:
  - `RedisModule`/`RedisService` (`src/redis/`) — `RedisService extends Redis` (ioredis), connects via `REDIS_URL` in constructor (`super(url)`), `onModuleDestroy` calls `this.quit()`. Wired into `LinksModule`.
  - `LinksService.findByCode` / `remove` implement cache-aside with a single consistent key format `` `link/${shortCode}` `` everywhere (get/set/del).
  - `findByCode`: cache miss → DB lookup → `set` + `expire(key, 3600)` (1h TTL) → return. Cache hit → return parsed JSON directly, no DB query.
  - `remove(id)`: uses the record returned by `prisma.link.delete()` (which includes `shortCode`) to build the invalidation key — `id` (UUID) and `shortCode` are different values, so the cache key can't be derived from `id` alone.
  - Decision made: raw `ioredis` + manual cache-aside in the service (not `@nestjs/cache-manager`/`CacheInterceptor`), to keep the read/write/invalidate flow explicit for learning.
  - Verified end-to-end via curl + `docker compose exec cache redis-cli`: miss populates `link/<code>` with TTL ~3600, second GET is a cache hit, DELETE removes the key, subsequent GET 404s (no stale cache).

## Gotchas discovered (don't re-debug these)

- **`.env` vs `compose.yaml` environment**: `apps/backend/.env` is for local dev (`npm run start:dev`, app on host) and is excluded from the Docker build context via `.dockerignore` (secrets shouldn't be baked into images). The running container only gets env vars from `compose.yaml`'s `app.environment` block — these must be kept in sync manually, and some values legitimately differ (e.g. `DATABASE_URL` uses `db:5432` in Docker vs `localhost:5433` locally, since `db` is the Docker service hostname).

- **JWT `expiresIn` typing**: `ConfigService.get<string>('JWT_EXPIRES_IN')` returns `string | undefined`, but `JwtModuleOptions.signOptions.expiresIn` expects `StringValue | number` (a template-literal type from the `ms` package, e.g. `"15m"`). Fix with a type assertion: `as SignOptions['expiresIn']` (`import type { SignOptions } from 'jsonwebtoken'`). See `auth.module.ts`.

- **Prisma 7 driver adapter**: the `prisma-client` generator (custom output `generated/prisma`) has no built-in query engine binary. `PrismaService` must construct `new PrismaPg({ connectionString: ... })` from `@prisma/adapter-pg` and pass it to `PrismaClient`.

- **CommonJS, not ESM**: `tsconfig.json` uses `module: commonjs` / `moduleResolution: node` (no `"type": "module"` in `package.json`). This is the standard `nest new` setup — don't switch to ESNext/bundler.

- **Docker `CMD` path**: runtime stage runs `node dist/src/main` (not `dist/main`), because `nest-cli.json` sets `sourceRoot: "src"`.

- **Local `npm run start:dev` fails (ESM/CJS clash)**: the `prisma-client` generator output (`generated/prisma/client.ts`) uses `import.meta.url` for an `__dirname` polyfill. Compiled to CommonJS, this is invalid for Node's CJS loader (`ReferenceError: exports is not defined`, file gets loaded via `importSyncForRequire`). Not fixed — use Docker (`docker compose up -d --build app`) for running/testing the backend instead, that's the verified working path.
