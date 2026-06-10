# CLAUDE.md

## Project context
Learning project — see `PROJECT_PLAN.md` for the full roadmap, tech stack, target structure, and Prisma schema.

## How to work on this project
- This is a learning project for the user (Docker, auth, caching). Explain *why* something is structured the way it is, not just *what* to write.
- Go step by step at the user's pace — don't jump ahead to later steps.
- Pair on conceptually new pieces (offer to explain + let the user write, or walk through together). Mechanical/repetitive parts (e.g. wiring a new endpoint following an existing pattern) can be left to the user to try first.

## Current status
- **Step 1 (CRUD)** — done. `LinksModule`: `POST/GET /links`, `GET /links/:code`, `DELETE /links/:id`.
- **Step 2 (Auth)** — partially done:
  - `POST /auth/register`, `POST /auth/login` (returns short-lived JWT access token) — done
  - `JwtStrategy` + `JwtAuthGuard` — done, protecting `POST /links` (`req.user.userId` replaces the old hardcoded `'anonymous'`)
  - **Not started yet**: `POST /auth/refresh` + `POST /auth/logout` with refresh token rotation (`RefreshToken` model already exists in `schema.prisma`) and httpOnly cookies
- **Docker stack** — `docker compose up -d --build` works end to end (db healthy, cache, app on `localhost:3000`).

## Gotchas discovered (don't re-debug these)

- **`.env` vs `compose.yaml` environment**: `apps/backend/.env` is for local dev (`npm run start:dev`, app on host) and is excluded from the Docker build context via `.dockerignore` (secrets shouldn't be baked into images). The running container only gets env vars from `compose.yaml`'s `app.environment` block — these must be kept in sync manually, and some values legitimately differ (e.g. `DATABASE_URL` uses `db:5432` in Docker vs `localhost:5433` locally, since `db` is the Docker service hostname).

- **JWT `expiresIn` typing**: `ConfigService.get<string>('JWT_EXPIRES_IN')` returns `string | undefined`, but `JwtModuleOptions.signOptions.expiresIn` expects `StringValue | number` (a template-literal type from the `ms` package, e.g. `"15m"`). Fix with a type assertion: `as SignOptions['expiresIn']` (`import type { SignOptions } from 'jsonwebtoken'`). See `auth.module.ts`.

- **Prisma 7 driver adapter**: the `prisma-client` generator (custom output `generated/prisma`) has no built-in query engine binary. `PrismaService` must construct `new PrismaPg({ connectionString: ... })` from `@prisma/adapter-pg` and pass it to `PrismaClient`.

- **CommonJS, not ESM**: `tsconfig.json` uses `module: commonjs` / `moduleResolution: node` (no `"type": "module"` in `package.json`). This is the standard `nest new` setup — don't switch to ESNext/bundler.

- **Docker `CMD` path**: runtime stage runs `node dist/src/main` (not `dist/main`), because `nest-cli.json` sets `sourceRoot: "src"`.
