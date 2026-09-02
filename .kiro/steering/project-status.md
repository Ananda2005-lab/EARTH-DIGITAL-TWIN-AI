# Earth Digital Twin AI — build status

Living checkpoint so a new session can resume without re-deriving context.
Update this file whenever a milestone lands.

_Last verified: 2026-08-16 · core build 100% complete_

## Shape of the repo

npm workspaces monorepo, `@edt/*` scope. Git initialised, branch `master`.

| Workspace         | Package       | State                                                          |
| ----------------- | ------------- | -------------------------------------------------------------- |
| `packages/shared` | `@edt/shared` | Done — types, Zod schemas, constants, utils.                   |
| `apps/api`        | `@edt/api`    | Done — 22 modules. Builds, lints, typechecks, 44 tests pass, auth verified e2e. |
| `apps/web`        | `@edt/web`    | Done — 42 routes, layer manager on `/globe`, clean build.      |
| `apps/ai`         | —             | FastAPI AI service skeleton with Dockerfile.                   |
| `scripts`         | —             | Gazetteer index builders + `verify-auth-e2e.cjs` auth harness. |
| `infra`           | —             | Local Postgres/Redis compose, prod compose, nginx config.      |

## Verified commands

All of these pass as of the last check. Run from the repo root.

```
npm run build:shared
npm run build:api
npm run build:web
npm run lint      --workspace @edt/api    # 0 errors, 0 warnings
npm run typecheck --workspace @edt/api
npm run lint      --workspace @edt/web    # next lint, clean
npm run typecheck --workspace @edt/web
npm test          --workspace @edt/api    # 7 suites, 44 tests
node scripts/verify-auth-e2e.cjs          # 7/7 checks against live API on :4000
```

Exercised against live Docker Postgres + Redis (`infra/docker/docker-compose.yml`),
migrated + seeded, API booted and auth flow verified end-to-end.

## API — what exists

22 Nest modules under `apps/api/src/modules`: admin, ai, analytics, auth,
bookmarks, cities, countries, environment, flights, hazards, health, jobs,
notifications, preferences, reports, search, ships, ships-relay, space, users,
weather, workspaces.

Global wiring in `app.module.ts`: Zod validation pipe, response envelope + error
filter, Redis response cache, audit interceptor, JWT / roles / permissions /
maintenance guards, throttler, request-id middleware, pino logging, BullMQ,
scheduler.

Prisma: 35 models, 30 enums, migration `0001_init`, seed script.

Tests: auth, users, countries services + pre-existing suites (44 tests total).
`AppException` exposes `code` (`NOT_FOUND`, `BAD_REQUEST`, …) — assert that,
not `statusCode`.

Versioning lives only in the `/api/v1` path prefix. Header-based versioning
was removed from `main.ts` because it 404'd every request missing
`x-api-version`.

## Web — what exists

Foundation:

- Design tokens and glass utilities in `globals.css`, dark + light + contrast-boost
- 14 UI primitives in `components/ui`
- Shell: `AppShell`, `Sidebar` (collapsible rail, persisted), `Topbar`,
  `CommandPalette` (⌘K), `ThemeToggle`
- Page primitives: `PageContainer`, `PageHeader`, `Section`, `StatCard`,
  `SeverityBadge`, `HazardKindIcon`
- `lib/api/client.ts` — typed envelope unwrapping, `ApiError`, `describeError`
- `app/api/[...path]/route.ts` — same-origin reverse proxy to the gateway
- `server/providers/*` — six upstream integrations (countries, weather, hazards,
  flights, maritime, space) with caching, so pages render without the gateway

42 routes built (incl. 12 admin sub-pages, `/login`, `/register`,
`/forgot-password`), verified with a real `next start` + HTTP fetch pass
(every route 200s) — not just a passing build.

`/globe` — the 3D digital twin (`components/globe/`) — is built on Three.js /
react-three-fiber: textured sphere, 177 country borders in one draw call,
point-in-polygon picking, fly-to camera, hazard markers.

**Layer system** (`components/globe/layers.ts`, `layer-panel.tsx`,
`data-points-layer.tsx`, `graticule.tsx`, `day-night.tsx`): driven from the
54-layer catalogue in `@edt/shared`. 9 live toggleable layers (borders,
graticule, day/night terminator, flights, ships, airports, seaports,
satellites, ISS) poll the gateway; hazard layers always on; planned layers
show a "Soon" badge. Selection persists in `localStorage` (`edt.globe.layers`).

## Deployment

- `.github/workflows/ci.yml` — install, shared build, prisma generate, lint,
  typecheck, API tests, api/web builds.
- `apps/api/Dockerfile`, `apps/web/Dockerfile` (Next standalone),
  `apps/ai/Dockerfile`.
- `infra/nginx/nginx.conf` reverse proxy; `infra/docker/docker-compose.prod.yml`
  (postgis 16, redis 7.4, api, web, nginx) with required-secret guards
  (`JWT_ACCESS_SECRET:?` etc.). Validated via `docker compose config`.

## Known remaining scope (not required for "complete")

- ~30 planned data layers in the catalogue (weather/environment/ocean raster
  tiles etc.) have no renderer yet — surfaced honestly as "Soon" in the panel.
- Live upstream feeds (flights/ships/space) work without keys; premium feeds
  need optional API keys in `apps/api/.env` when available.
- `/globe` WebGL render was previously verified via headless Playwright; the
  new layers compile and typecheck but weren't re-driven headlessly.

## Deviations from the original brief

- **MapLibre GL + react-three-fiber, not CesiumJS.** That is what `apps/web`
  declares as dependencies.
- `apps/ai` FastAPI service exists alongside the Nest `ai` module.

## Gotchas worth remembering

- **Keep `zod` on a single version.** Root `package.json` has an `overrides`
  entry pinning it. Two copies (one hoisted, one nested under `packages/shared`)
  made every controller trip `TS2589` and drove `tsc` past an 8 GB heap. If
  typechecking hangs or OOMs, check for a duplicate `zod` install first.
- **API ESLint config is `.eslintrc.cjs`, not JSON,** because
  `parserOptions.tsconfigRootDir` must be an absolute path (`__dirname`).
- **`Button` uses `Slottable`.** Without it, `asChild` plus the loading spinner
  hands Radix `Slot` two children and every page using `<Button asChild>` fails
  to prerender. Same care is needed in any primitive that renders siblings
  alongside `children`.
- Pages that read live upstream feeds must set `export const dynamic =
  'force-dynamic'`, or `next build` will try to prerender them and hit the
  network.
- **A passing `next build` does not prove a WebGL/canvas scene renders.**
  Run the dev server and hit the route, or drive it with Playwright, before
  trusting a 3D/canvas page.
- Auth register requires `acceptTerms: true` (Zod literal); session tokens
  live at `data.tokens.accessToken`; refresh uses the httpOnly cookie.
- Delegating a broad task to a sub-agent can significantly overshoot the
  stated scope. Review the diff before assuming the scope matches the ask.
