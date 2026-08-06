# Earth Digital Twin AI — build status

Living checkpoint so a new session can resume without re-deriving context.
Update this file whenever a milestone lands.

_Last verified: 2026-08-06 · roughly 87% complete_

> **DONE (2026-08-06):** milestone 4 of the completion checklist — "more 2D
> map layers" — shipped as commit `b62e947`. Four new live layers added to
> `/map`: `ocean_currents` (ECMWF IFS `ocean_u/v_current` via `om://`),
> `labels` (keyless Esri World_Reference_Overlay raster), `aurora` (NOAA SWPC
> OVATION oval, split into per-hemisphere dashed polylines) and `satellites`
> (CelesTrak TLEs propagated with satellite.js SGP4 — ISS/GPS/GLONASS/Galileo,
> refreshed every minute, clickable with orbit altitude). Verified with
> Playwright: all four toggles render, zero console errors, om decodes
> (200/206), esri 60×200, noaa 200, celestrak 4×200. Typecheck, lint and
> `next build` all pass.

## Project goal (original brief)

Build "Earth Digital Twin AI": a web platform that is an interactive digital
twin of Earth. It combines a 3D globe and a 2D map mission view with live,
real-time earth data — weather, ocean, hazards, flights, ships, space — plus
country/city profiles, analytics, admin, AI assistant, and user accounts.
Technical shape: npm-workspaces monorepo (`@edt/*`), NestJS API
(`apps/api`), Next.js web app (`apps/web`), shared types/schemas/constants
(`packages/shared`). Stack chosen over the brief: MapLibre GL + react-three-
fiber instead of CesiumJS; AI lives in the Nest `ai` module (no FastAPI).

## API keys the user must provide

Most of the map data is keyless and works as-is (Open-Meteo weather, NASA GIBS
rasters, NOAA aurora, CelesTrak TLEs, RainViewer radar, GDACS hazards, Esri
basemaps). These features are **disabled until the user supplies a key** (the
code self-disables when the env var is absent — see `apps/web/.env.example`):

| Env var(s) | Unlocks | Get it at |
| ---------- | ------- | --------- |
| `AISSTREAM_API_KEY` | Live ships / AIS vessels (`/ships`, ships layer — currently EMPTY without it) | https://www.aisstream.io — free tier |
| `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` | Reliable live flights (anonymous free tier is rate-limited / flaky) | https://opensky-network.org — free account |
| `NASA_FIRMS_API_KEY` | Wildfires layer (catalogue marks it `requiresKey`) | https://earthdata.nasa.gov — free FIRMS key |
| `TOMTOM_API_KEY` | Live traffic layer (catalogue marks it `requiresKey`) | https://developer.tomtom.com — free tier |
| `MAPTILER_API_KEY` | Extra basemap styles / terrain | https://cloud.maptiler.com |
| `CESIUM_ION_TOKEN` | World terrain / photogrammetry tiles | https://ion.cesium.com |

How to apply: copy `apps/web/.env.example` → `apps/web/.env.local`, fill the
values, restart the web dev server, then `npm run prewarm --workspace @edt/web`.

Not a key but required for full functionality: a running **Postgres + Redis**
(local compose stack in `infra/docker`) so auth E2E, the live gazetteer and the
admin pages actually work — the API reads `apps/api/.env.example` for those
connection strings. Also note: premium catalogue layers (`lightning`,
`co2_emissions`) need paid plans, not just keys.

## Remaining work to completion (checklist)

Everything left before the project is done. Tick off as it lands.

1. **Tests** — zero spec files anywhere. Add at least unit tests for
   `packages/shared` and key API modules, plus a couple of web smoke tests.
2. ~~**CI + deploy artifacts**~~ — DONE (`4abb379`): GitHub Actions workflow,
   Dockerfiles for both apps, nginx reverse proxy, prod compose stack. Not
   build-tested here (no Docker CLI in this environment).
3. **Auth end-to-end verification** — forms exist but nobody has run the API
   against a live Postgres and clicked register → login → session yet.
4. **More 2D map layers** (~26 left) — wired so far: ocean currents, place
   labels, aurora, satellites. Remaining candidates need heavier sources:
   submarine cables (TeleGeography data path on GitHub changed → 404),
   power grid (OpenInfraMap tiles blocked), population/urban (WorldPop/GHSL,
   no keyless tiles), transit (OSM/Transitland vector tiles), forest cover /
   protected areas (GFW/WDPA), timezones (large GeoJSON), lightning (premium),
   live traffic (key), tsunami, bathymetry.
5. **Live 40k-city gazetteer** — `/cities/[id]` still renders from the bundled
   curated list; wiring the gazetteer API would serve any city.
6. **Remaining API polish** — API is ~95%; audit the last ~5% (endpoints not
   yet exercised against live Postgres/Redis).

## Resuming from a fresh session (ops)

- Start with `git submodule update --init --recursive --depth 1` if `.gitmodules`
  exists (none currently). Branch is `master`; commit conventions are
  conventional-commit style (`feat(web): …`, `chore: …`), push to
  `origin/master` directly and verify the push after every milestone.
- Always `npm run build:shared` first (web consumes `@edt/shared` from `dist/`).
- Verified green commands: `npm run build:shared`, `build:api`, `build:web`,
  and per-workspace `lint` + `typecheck` for `@edt/api` and `@edt/web`.
- Dev servers: web dev server serves on `http://localhost:3000` (check
  `package.json` scripts for exact commands; web proxies `/api` to the API).
- **After starting the web dev server, run `npm run prewarm --workspace @edt/web`.**
  Next dev compiles each route on first request (3–6s per first click); prewarm
  requests every route once so section clicks open in ~0.5s. Needs re-running
  after a dev-server restart. (Map page flight load is capped at 500 — OpenSky
  is the slowest upstream.)
- After any web/globe/map change, verify at runtime with Playwright against the
  live dev server, not just `next build` — headless Chromium needs
  `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL compositing.

## Shape of the repo

npm workspaces monorepo, `@edt/*` scope. Git initialised, branch `master`.

| Workspace         | Package       | State                                                          |
| ----------------- | ------------- | -------------------------------------------------------------- |
| `packages/shared` | `@edt/shared` | Done — types, Zod schemas, constants, utils.                   |
| `apps/api`        | `@edt/api`    | ~95% — 21 controllers, 139 endpoints. Builds, lints, typechecks. |
| `apps/web`        | `@edt/web`    | ~32% — foundation done, all 43 routes built, `/map` now live.   |
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

**Live weather, ocean and environmental layers landed** (commit `759d7d3`). The
`/map` layer catalogue now supports 13 more data layers on top of the original
12, all functional and verified against live sources, not placeholders:

- **Real-time weather rasters** (temperature, cloud cover, pressure, wind, air
  quality, wave height) via the `@openmeteo/weather-map-layer` `om://` protocol
  (Open-Meteo map tiles — `dwd_icon`, `cams_global`, `dwd_gwam`). The `om`
  protocol is registered lazily with `maplibregl.addProtocol('om', …)`.
- **Wind** additionally renders a dynamic arrow vector layer from wind-u/v.
- **Environmental rasters** (sea surface temperature, sea ice, snow cover,
  vegetation NDVI, night luminosity) via NASA GIBS WMTS
  (`gibs.earthdata.nasa.gov`), keyless. Layer id must be `MODIS_Terra_NDVI_8Day`
  (`MODIS_Terra_NDVI` alone 404s); snow/sea-ice tiles outside polar coverage
  legitimately 404 and stay transparent.
- **Client-generated geometry**: `graticule` (10° meridians/parallels) and
  `day/night` (terminator fill + dashed line, computed from the subsolar point)
  are built in `map-data.ts` rather than fetched.
- Default-enabled layers are now `['borders','day_night','earthquakes']`.

Two pre-existing runtime bugs were found and fixed during verification: (1) the
"Style is not done loading." crash when layers synced before the style load
event (layer sync now waits on `'load'` / `isStyleLoaded()`); (2) MapLibre
forces its container to `position: relative !important`, collapsing an
`absolute inset-0` wrapper to 0 height — the canvas is now wrapped in
`<div className="absolute inset-0"><div ref={containerRef} className="h-full w-full" /></div>`.

Verified with a Playwright pass against the live dev server (headless Chromium
needs `--use-angle=swiftshader` for WebGL compositing): all 17 layer toggles
succeed with zero console/page errors; `om://` fetches return 200/206 and
decode; GIBS layers return 200 (150 requests; only sea-ice edge tiles 404);
RainViewer precipitation returns 200; canvas pixel stats jump from ~6.7k to
~114k colorful pixels when layers are enabled. `next build`, web typecheck and
web lint all pass.

`/countries/[code]` and `/cities/[id]` are now deep detail pages rather than
thin shells. Both are connected to the 2D map via a reusable `MapEmbed`
client component (`components/map/map-embed.tsx`) that renders a compact
non-interactive MapLibre view from the shared basemap catalogue with a marker
and an "Open in map" link through to `/map`. The country profile now shows the
country on the map, its curated major cities (linking to `/cities/[id]`), and
live capital weather via `getWeather`. The city profile shows the city on the
map, overview facts, live current conditions, and its nearest major airports.
`/cities/[id]` resolves against `getMajorCities()` and calls `notFound()` for
unknown ids, mirroring the existing country route.

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

That's 43 routes total, verified with a real `next start` + HTTP fetch pass
(every route 200s, no Server Components crash) — not just a passing build.

## Not started

1. **Tests.** Zero spec files anywhere. CI does not run a test step yet —
   add one (`npm run test --workspaces --if-present`) once specs exist, since
   the web `vitest run` currently fails with "no test files found".
2. **Auth is unverified end-to-end.** Forms exist and typecheck, but no one
   has run the API against a live Postgres and clicked through
   register → login → session yet.

## Done since the last checkpoint

- **CI + Docker (commit `4abb379`, checklist item 2).** `.github/workflows/ci.yml`
  runs `npm ci` → `build:shared` → `prisma:generate` → `lint` → `typecheck` →
  `build` on every push/PR. Multi-stage Dockerfiles for `apps/api` and
  `apps/web`, `infra/docker/nginx.conf` (single reverse proxy: `/api/` →
  api:4000, rest → web:3000), `infra/docker/docker-compose.prod.yml`
  (web+api+nginx+postgres+redis full stack), root `.dockerignore`.
  **Not build-tested here — Docker CLI is unavailable in this environment.**
  Validate with `docker compose -f infra/docker/docker-compose.prod.yml up -d --build`
  on a machine that has Docker, and confirm the Actions run on GitHub.
- **Dev-server prewarm (commit `425df94`).** `npm run prewarm --workspace @edt/web`
  compiles all routes up front so section clicks are ~0.5s instead of 3-6s.
- **Map layers milestone 4 (commit `b62e947`).** ocean currents, place labels,
  aurora, satellites layers.

## Next up

1. **More 2D map layers.** The catalogue still has ~30 layers beyond the ~25
   wired into `/map`. Society/infrastructure layers (roads, buildings, land
   use) are best served by the existing Esri basemaps; space layers (satellite
   tracks, orbits) need a TLE feed; ocean currents need a current velocity
   source. Weather and environmental raster coverage is now complete.
2. **Live city gazetteer.** `/cities/[id]` renders from the bundled curated
   list today; wiring the 40k-city gazetteer API would let detail pages serve
   any city, not just the curated set.

## Deviations from the original brief

- **No FastAPI service.** AI lives in the Nest `ai` module.
- **MapLibre GL + react-three-fiber, not CesiumJS.** That is what `apps/web`
  declares as dependencies.

## Gotchas worth remembering

- **Prisma client is NOT auto-generated** — there is no postinstall hook, so
  after a fresh `npm ci` the API build fails with "no exported member
  `AuditLogWhereInput`" / "`PrismaClientKnownRequestError` does not exist".
  Run `npm run prisma:generate --workspace @edt/api` before `build:api`. CI
  and the API Dockerfile both do this explicitly.
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
- **Headless screenshots of WebGL content are flaky unless Chromium is
  launched with `--use-angle=swiftshader --enable-unsafe-swiftshader`.** Without
  those flags the map canvas intermittently composites as pure black in
  Playwright. Add them to any canvas-rendering check.
- **Read layer labels from the catalogue for UI toggles.** Layer switches are
  aria-labelled `Toggle <label>` (e.g. `Toggle Live Flights`, `Toggle Rain &
  Snow`), not the short ids. The panel needs `scrollIntoViewIfNeeded` before
  clicking since it is a scroll area.
- **`satellite.js` must stay on v5, not v7.** v7's ESM build pulls in a WASM
  runtime that imports `node:module` / `node:worker_threads`, which breaks
  `next build` (`UnhandledSchemeError`). v5 (`lib/index.js`) is pure JS and
  ships its own types. Also: `propagate()`'s `.position` is typed
  `EciVec3 | boolean` where the `true` case is truthy — guard with
  `typeof position === 'boolean'` before calling `eciToGeodetic`.
- **Open-Meteo map-tile variable names differ per model, and some models lack
  whole categories.** Probe `.../latest.json?variable=<x>` and read the
  returned `variables` array instead of guessing. `dwd_gwam` has waves only;
  ocean currents live on `ecmwf_ifs025` as `ocean_u_current` /
  `ocean_v_current`. A wrong variable decodes fine as TileJSON but throws
  "Variable … not found" at `.om` decode time (visible as console errors).
- Delegating a broad task to a sub-agent can significantly overshoot the
  stated scope (asked for 4 pages, got ~23). Review the diff before assuming
  the scope matches the ask, even if typecheck/lint/build all pass.
