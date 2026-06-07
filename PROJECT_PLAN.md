# Link Shortener — Project Plan for Claude Code

## Context
This document describes a full-stack link shortener project being built as a learning exercise.
The goal is not just to ship a working app, but to practice real-world patterns:
repository pattern, service layer, proper auth, caching, background jobs, and Docker.

When helping with this project, always:
- Prefer TypeScript strict mode
- Use Prisma for database access
- Keep controllers thin — logic belongs in services
- Validate all inputs at the API boundary with class-validator DTOs
- Read environment variables via NestJS ConfigService, never hardcode values

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache | Redis |
| Queue | BullMQ |
| Containerisation | Docker + Docker Compose |

---

## Project Structure (target)

```
my-app/
├── apps/
│   ├── backend/           # NestJS app
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── prisma/
│   │   │   │   └── prisma.service.ts
│   │   │   ├── links/
│   │   │   │   ├── links.module.ts
│   │   │   │   ├── links.controller.ts
│   │   │   │   ├── links.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-link.dto.ts
│   │   │   │       └── update-link.dto.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── guards/
│   │   │   │       └── jwt.guard.ts
│   │   │   └── analytics/
│   │   │       ├── analytics.module.ts
│   │   │       └── analytics.processor.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── Dockerfile
│   │   ├── .env
│   │   ├── .env.example
│   │   └── package.json
│   ├── frontend/          # React + Vite app
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── worker/            # BullMQ worker (later)
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml
├── .env                   # root env for Docker Compose (added later)
└── .env.example
```

---

## Database Schema (Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  links        Link[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Link {
  id        String   @id @default(uuid())
  shortCode String   @unique
  url       String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime?
  createdAt DateTime @default(now())
  clicks    Click[]
}

model Click {
  id        String   @id @default(uuid())
  linkId    String
  link      Link     @relation(fields: [linkId], references: [id])
  country   String?
  referrer  String?
  device    String?
  createdAt DateTime @default(now())
}
```

---

## Build Steps (in order)

### Step 1 — NestJS + Prisma foundation (current step)
**Goal:** basic CRUD API working against a local Postgres instance, no Docker yet.

- [ ] Init NestJS project inside `apps/backend/`
- [ ] Install and configure Prisma (`npm install prisma @prisma/client`)
- [ ] Write `schema.prisma` with `User`, `Link`, `Click`, `RefreshToken` models
- [ ] Run first migration (`npx prisma migrate dev --name init`)
- [ ] Create `PrismaService` wrapping `PrismaClient`
- [ ] Create `LinksModule` with controller, service, and DTOs
- [ ] Implement four endpoints:
  - `POST   /links`        — create link (generate random short code)
  - `GET    /links`        — list all links
  - `GET    /links/:code`  — get one link by short code
  - `DELETE /links/:id`    — delete link
- [ ] Add `class-validator` + `class-transformer` for DTO validation
- [ ] Enable global `ValidationPipe` in `main.ts`
- [ ] Add `ConfigModule` (isGlobal: true) for env var access

**Environment variables needed (`.env` in `apps/backend/`):**
```env
DATABASE_URL="postgresql://postgres:secret@localhost:5432/linkshortener"
PORT=3000
```

---

### Step 2 — Auth end-to-end
**Goal:** working register/login with JWT access tokens + refresh token rotation stored in httpOnly cookies.

- [ ] Create `AuthModule` with `AuthController` and `AuthService`
- [ ] Install `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`
- [ ] Implement `POST /auth/register` — hash password, create user
- [ ] Implement `POST /auth/login` — validate credentials, issue access + refresh tokens
- [ ] Implement `POST /auth/refresh` — validate refresh token, rotate it, issue new access token
- [ ] Implement `POST /auth/logout` — invalidate refresh token
- [ ] Store refresh tokens in database (`RefreshToken` model)
- [ ] Access token: short-lived (15m), returned in response body
- [ ] Refresh token: long-lived (7d), stored in `httpOnly` cookie
- [ ] Create `JwtAuthGuard` to protect routes
- [ ] Scope links to authenticated user (link CRUD requires auth)

**Additional environment variables:**
```env
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d
```

---

### Step 3 — Redis cache layer
**Goal:** redirect endpoint (`GET /:code`) uses Redis to avoid hitting the database on every click.

- [ ] Add Redis to local environment (or Docker for just Redis)
- [ ] Install `ioredis` or `@nestjs/cache-manager` with Redis store
- [ ] On redirect: check Redis first, fall back to Postgres on miss, write to cache
- [ ] On link update or delete: invalidate the cache entry for that short code
- [ ] Set a sensible TTL (e.g. 1 hour)

**Additional environment variables:**
```env
REDIS_URL=redis://localhost:6379
```

---

### Step 4 — Click analytics queue
**Goal:** every redirect fires a background job that records click data without slowing down the redirect.

- [ ] Install `bullmq`, `@nestjs/bullmq`
- [ ] Create `AnalyticsModule` with a queue producer and processor
- [ ] On redirect: enqueue a job with `{ linkId, ip, referrer, userAgent }`
- [ ] Processor: parse country from IP, device from user agent, write `Click` record to DB
- [ ] Worker runs as a separate process (separate service in Docker Compose later)

---

### Step 5 — Docker Compose
**Goal:** entire stack starts with `docker compose up` from the project root.

- [ ] Write `Dockerfile` for backend (two-stage: build + runtime)
- [ ] Write `Dockerfile` for worker
- [ ] Write `docker-compose.yml` at project root with services:
  - `backend` — NestJS app
  - `worker` — BullMQ processor
  - `db` — Postgres 16
  - `cache` — Redis 7
- [ ] Add healthcheck on `db`, `depends_on` with `condition: service_healthy`
- [ ] Move `.env` to project root for Docker Compose
- [ ] Named volumes for Postgres and Redis data persistence
- [ ] Confirm `DATABASE_URL` uses `db` hostname, `REDIS_URL` uses `cache` hostname

---

### Step 6 — React dashboard
**Goal:** minimal frontend showing the user's links and click analytics.

- [ ] Init Vite + React project inside `apps/frontend/`
- [ ] Auth screens: register, login (store access token in memory, refresh via cookie)
- [ ] Links page: table of links with short code, destination URL, click count
- [ ] Create link form: input URL, get back short code
- [ ] Basic click chart per link (recharts or similar)
- [ ] API base URL via environment variable (`VITE_API_URL`)

---

### Stretch goals (after all steps complete)
- [ ] Rate limiting on redirect endpoint (Redis-based, per IP)
- [ ] Link expiry (scheduled job marks links inactive after `expiresAt`)
- [ ] Custom short codes (user provides their own slug, with collision check)
- [ ] Integration test suite (supertest on API endpoints)
- [ ] CI pipeline (GitHub Actions: lint, test, build on push)
- [ ] Production deployment (VPS + Docker Compose or cloud provider)

---

## Key Patterns to Follow Throughout

**Thin controllers** — controllers only parse HTTP and call a service method. No business logic, no database access.

**Service layer** — all business logic lives here. Services call repositories/Prisma, never raw HTTP concepts.

**DTO validation** — every endpoint that accepts a body has a DTO class decorated with class-validator. The global `ValidationPipe` rejects invalid input before it reaches the service.

**Environment variables** — always via `ConfigService`, never `process.env` directly in application code. Exception: `PrismaService` which reads `DATABASE_URL` automatically.

**Error handling** — use NestJS built-in exceptions (`NotFoundException`, `ConflictException`, `UnauthorizedException`) from the service layer. Never return raw errors to the client.

**Migrations** — never use `synchronize: true` in production. Every schema change is a named migration file committed to git.
