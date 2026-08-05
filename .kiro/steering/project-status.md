# Earth Digital Twin AI — build status

Living checkpoint so a new session can resume without re-deriving context.
Update this file whenever a milestone lands.

_Last verified: 2026-08-05 · roughly 80% complete_

## Shape of the repo

npm workspaces monorepo, `@edt/*` scope. Git initialised, branch `master`.

| Workspace         | Package       | State                                                          |
| ----------------- | ------------- | -------------------------------------------------------------- |
| `packages/shared` | `@edt/shared` | Done — types, Zod schemas, constants, utils.                   |
| `apps/api`        | `@edt/api`    | ~95% — 21 controllers, 139 endpoints. Builds, lints, typechecks. |
| `apps/web`        | `@edt/web`    | ~20% — foundation done, 4 of ~40 routes built.                  |
| `scripts`         | —             | Two gazetteer index builders.                                  |
| `infra/docker`    | —             | Local Postgres/Redis compose stack.                            |

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
```

Nothing has been exercised against a live Postgres or Redis yet, and the dev
server has not been run end-to-end.

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

Routes built (~24 of ~40): `/`, `/dashboard`, `/countries`, `/countries/[code]`,
`/hazards`, `/cities`, `/weather`, `/environment`, `/timezones`, `/flights`,
`/ships`, `/space`, `/ai`, `/analytics`, `/compare`, `/bookmarks`, `/reports`,
`/workspace`, `/history`, `/notifications`, `/profile`, `/settings`,
`/timeline`, `/tourism`, `/login`, `/register`, `/globe`, `/map`. Plus
`error.tsx`, `not-found.tsx`, `(app)/loading.tsx`.

`/globe` — the 3D digital twin (`components/globe/`) — is built on Three.js /
react-three-fiber, not MapLibre: a textured sphere, all 177 country borders in
one draw call, point-in-polygon click/hover picking, an animated fly-to camera,
and hazard markers colour-coded by severity. Verified with a headless
Playwright pass (canvas renders, click selects a country and opens the info
panel, zero console errors) since a clean `next build` doesn't prove a WebGL
scene actually renders.

`/map` — the 2D mission view (`components/map/`) — is the first real MapLibre
GL consumer of the shared `LAYERS` catalogue. It renders the full basemap set
(satellite, hybrid, terrain, street, midnight, daylight, night lights, ocean)
plus 12 live data layers wired to the existing providers: political borders
(Natural Earth 110m), RainViewer radar precipitation (live frame resolved at
toggle time), the five hazard layers (earthquakes, wildfires, volcanoes,
floods, cyclones) coloured by severity with depth/magnitude-scaled markers,
live flights (altitude-tinted ADS-B), ships (AIS), ISS with a dashed ground
track, and airports/seaports. The layer manager on the right drives basemap
swaps (via `RasterTileSource.setTiles`, so the style is never rebuilt) and
per-category toggles with live counts; unsupported catalogue layers show a
lock and stay disabled. Popups render click details from feature properties.
`map-data.ts` holds the GeoJSON conversion + RainViewer frame resolution so
the shell stays declarative. Verified with a clean build + live dev-server
fetch of `/map` (200, no runtime errors).

All 12 admin sub-pages are built: `/admin` (overview KPIs), `/admin/users`,
`/admin/countries` + `/admin/countries/[code]` (edit form), `/admin/cities`
(placeholder — no live gazetteer endpoint yet), `/admin/reports`,
`/admin/analytics`, `/admin/ai-logs`, `/admin/feature-flags`,
`/admin/notifications` (broadcast composer), `/admin/api-keys` (issue/rotate/
revoke, one-time secret reveal), `/admin/audit`, `/admin/system` (health,
maintenance toggle, cache/circuit controls). All wrap their fetch in try/catch
and fall back to `RequireAuthNotice` on 401/403 rather than crashing when
there's no session. `/forgot-password` is also built, closing the dead link
from the login form.

That's 42 routes total, verified with a real `next start` + HTTP fetch pass
(every route 200s, no Server Components crash) — not just a passing build.

## Not started

1. **Tests.** Zero spec files anywhere.
2. **CI.** No GitHub Actions workflows. No Nginx config or Dockerfiles for the
   apps (only the local Postgres/Redis compose stack exists).
3. **Auth is unverified end-to-end.** Forms exist and typecheck, but no one
   has run the API against a live Postgres and clicked through
   register → login → session yet.

## Next up

1. **Remaining 2D map layers.** The catalogue has ~40 more layers than the 12
   wired into `/map`; weather rasters (temperature, wind, clouds, air quality),
   ocean (SST, currents, wave height), society, infrastructure and space
   layers still need live feeds or operator API keys before they can render.
2. **Country / city deep pages.** `/countries/[code]` and `/cities` exist but
   `/cities/[id]` and richer detail views are still thin.

## Deviations from the original brief

- **No FastAPI service.** AI lives in the Nest `ai` module.
- **MapLibre GL + react-three-fiber, not CesiumJS.** That is what `apps/web`
  declares as dependencies.

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
  `getHazardFeed`'s dedup logic called `.toFixed()` on coordinates that GDACS
  sometimes returns as strings, which only threw at runtime on `/globe`
  (`/hazards` takes a different code path) — `tsc`, ESLint and the production
  build were all green while the page 500'd. Run the dev server and hit the
  route, or drive it with Playwright, before trusting a 3D/canvas page.
- Delegating a broad task to a sub-agent can significantly overshoot the
  stated scope (asked for 4 pages, got ~23). Review the diff before assuming
  the scope matches the ask, even if typecheck/lint/build all pass.
