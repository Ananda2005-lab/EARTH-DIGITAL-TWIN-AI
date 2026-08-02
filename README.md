# Earth Digital Twin AI

A real-time digital twin of Earth: an immersive globe, fused live geospatial
feeds and AI-assisted location intelligence in one platform.

## Repository layout

npm workspaces monorepo, `@edt/*` scope.

```
apps/api          NestJS API — REST, auth, jobs, Prisma/PostGIS persistence
apps/web          Next.js client (in progress)
packages/shared   Types, Zod schemas, constants and utilities shared by both tiers
scripts           Gazetteer index builders
infra/docker      Local Postgres + Redis
```

## Prerequisites

- Node.js 20.11 or newer, npm 10 or newer
- Docker (for Postgres with PostGIS, and Redis)

## Quickstart

```bash
npm install

# Postgres (PostGIS) on 5432 and Redis on 6379, bound to localhost only
npm run docker:up

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in the four required values in `apps/api/.env` — `DATABASE_URL` already
matches the Docker defaults, and the three secrets need at least 32 characters
each:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, MFA_ENCRYPTION_KEY
```

Then set up the database and start both apps:

```bash
npm run db:migrate
npm run db:seed          # prints generated passwords for the seeded accounts
npm run dev              # API on :4000, web on :3000
```

- API base URL: `http://localhost:4000/api/v1`
- API reference: `http://localhost:4000/api/docs`
- Web: `http://localhost:3000`

## Everyday commands

| Command               | What it does                          |
| --------------------- | ------------------------------------- |
| `npm run dev`         | API and web in watch mode             |
| `npm run build`       | Production build of both apps         |
| `npm run typecheck`   | `tsc --noEmit` across every workspace |
| `npm run lint`        | ESLint across every workspace         |
| `npm run test`        | Test suites across every workspace    |
| `npm run format`      | Prettier write across the repo        |
| `npm run db:migrate`  | Apply pending migrations              |
| `npm run db:seed`     | Seed reference data and demo accounts |
| `npm run docker:up`   | Start Postgres and Redis              |
| `npm run docker:down` | Stop them                             |

Scope any of them to one workspace with `--workspace @edt/api` or
`--workspace @edt/web`.

## Conventions

- **Contracts live in `@edt/shared`.** Zod schemas there are the single source of
  truth: the API turns them into DTOs and OpenAPI schemas via `zodDto`, and the
  web tier imports the same types. Change a contract once and both tiers fail to
  compile until they agree.
- **Responses are enveloped.** Success is `{ data, meta }`; failure is the shared
  `ApiErrorBody` (`statusCode`, `code`, `message`, `details`, `path`,
  `requestId`, `timestamp`). Branch on `code`, never on message text.
- **Coordinates are `{ lng, lat }`** in that order, and bounding boxes are
  `[west, south, east, north]`.
- **Spatial queries use PostGIS**, but `lng`/`lat` doubles remain authoritative
  so losing the extension costs performance, never correctness. See the header
  comment in `apps/api/prisma/schema.prisma`.
- **Optional provider keys degrade one feature.** Anything absent from the
  environment disables its own feed instead of failing a request.

## Status

`.kiro/steering/project-status.md` tracks what is built, what is missing and the
gotchas worth knowing before starting work.
