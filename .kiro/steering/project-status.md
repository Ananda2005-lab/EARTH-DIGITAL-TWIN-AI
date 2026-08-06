# Earth Digital Twin AI — build status

Living checkpoint so a new session can resume without re-deriving context.
Update this file whenever a milestone lands.

_Last verified: 2026-08-06 · roughly 93% complete_

> **DONE (2026-08-06):** checklist item 5 **closed — live city gazetteer wired
> end-to-end.** Previously `/cities` and `/cities/[id]` rendered only from a
> bundled ~41-city curated list. The gazetteer API (Prisma/Postgres-backed,
> `GET /cities`, `by-slug/:countryCode/:slug`) was already built but the web
> never called it, and the seeded capitals had `population: 0` because
> `city-reference.json` was absent (the seed fell back to deriving capitals
> from the country reference). Fixed both: (1) **data** — Wikidata SPARQL
> (`build-city-index.mjs`) is down (504/timeout), so a new keyless fallback
> builder `scripts/build-city-index-openmeteo.mjs` resolves all 210 capital
> cities via the Open-Meteo geocoding API (the API's existing attribution
> source) and writes `city-reference.json` in the seed's exact shape; reseed
> now converges with **205/210 capitals carrying real populations** (Paris
> 2.1M). (2) **web wiring** — `server/providers/cities.ts` gained
> `getGazetteerCities()` (pages through the `/api` proxy, curated list as
> offline fallback) and `getCityByIdentifier()` (round-trips the `tokyo-jp`
> web slug to `by-slug/JP/tokyo`, falls back to curated on 404/gateway-down).
> `/cities` list now shows all **210 seeded capitals** (was 41), `/cities/[id]`
> serves any seeded city with live population, and unknown ids render the
> not-found boundary. Verified against the live stack (Postgres 15 + PostGIS +
> Redis 7 reinstalled this session, migration reapplied, reseeded): list 200
> with 210 tiles incl. Ottawa/Canberra, Paris detail 200 with `2.1M` people,
> unknown id → 404 content. Web typecheck + lint green. Remaining: the full
> 40k-city gazetteer still depends on Wikidata coming back up (or a keyed
> source); the two `build-city-index*` scripts document both paths.
>
> **DONE (2026-08-06):** checklist item 3 **closed — browser session works end-to-end.**
> The last open finding from the web UI pass is fixed: the API now mirrors the
> short-lived access token into an HttpOnly `edt_access` cookie alongside
> `edt_refresh` (register / login / refresh / OAuth complete all set it, logout
> clears both). The JWT strategy already read `edt_access`, so `/auth/me` and
> every user-scoped endpoint now authenticate from the browser. Re-ran the
> Playwright pass: **9/9 green** including `browser /auth/me 200 via access
> cookie` (was the 401 finding). Logout still clears both cookies and `/auth/me`
> 401s after. API typecheck + 33 tests green. Checklist item 3 fully ticked.
>
> **DONE (2026-08-06):** checklist item 3 Phase 3 — **web UI auth pass via Playwright
> (9/9 checks)** against the live stack. Register → dashboard, `edt_refresh`
> HttpOnly cookie set, cookie-based `/auth/refresh` rotates tokens, admin page
> shows "Sign in required" gate for a plain user, logout 204 clears session,
> wrong password shows the error banner, correct login → dashboard. **Two bugs
> found + fixed:** (1) the `/api/*` reverse proxy forwarded the upstream's
> `content-encoding: br`/`content-length` after undici had already decoded the
> body, so every brotli response 500'd in the browser with
> `ERR_CONTENT_DECODING_FAILED` (login/register silently broke once the API
> compressed; now the proxy strips both headers); (2) `getHazardFeed`'s
> dedup bucketed by `kind:lat:lng:time`, letting the same GDACS event through
> twice and tripping React's duplicate-key warning on `/dashboard` (hard-dedupes
> on `event.id` first). **Open finding (not yet fixed):** the web client never
> persists the access token — `login`/`register` receive `AuthSession` but
> discard it, and only `edt_refresh` is set. The JWT strategy already accepts an
> `edt_access` cookie (jwt.strategy.ts:27), so user-scoped endpoints (`/auth/me`,
> `/admin/*` data, `/profile`, bookmarks) 401 from the browser. Admin pages
> degrade gracefully to `RequireAuthNotice`. Fix candidates: set `edt_access`
> cookie server-side alongside refresh, or persist + re-attach the token
> client-side. Web typecheck + lint green.
>
> **DONE (2026-08-06):** checklist item 3 Phase 3 prep — **stack rebooted in a fresh
> session** (env installs don't persist between sessions). Postgres 15 + PostGIS +
> Redis 7 reinstalled via apt (no Docker here), `edt` role/db recreated, `npm ci`
> re-run, `build:shared` + `prisma:generate` re-run, migration `0001_init`
> reapplied, seed reconverged (4 users / 250 countries / 210 cities / 6 flags).
> API boots on `:4000/api/v1` (live DB + Redis), web dev server boots on `:3000`.
> **Found + fixed a first-boot web bug:** `apps/web/src/lib/env.ts` used
> `z.string().min(8).optional()`, which rejects `''` values, so copying
> `.env.example` → `.env.local` verbatim made the `/api/*` reverse proxy 500 on
> every request ("Invalid server environment: NASA_FIRMS_API_KEY: String must
> contain at least 8 character(s); …"). Applied the same `optionalString`
> (`trim → ''→undefined → pipe(min)`) pattern the API uses; `/api/health` now
> proxies 200 through the web server. Web typecheck green. **Next: Playwright
> register → login → session pass (Phase 3 proper).**
>
> **DONE (2026-08-06):** checklist item 3 "Auth end-to-end verification" — Phase 1
> landed: **live Postgres 15 + Redis running locally** (no Docker in this
> environment, so `apt-get` was used instead of `infra/docker` compose), the API
> `.env` was generated with random JWT/MFA secrets + seed passwords, Prisma
> migration `0001_init` applied cleanly, and the **seed script was fixed** — it
> defined `seedUsers`/`seedFeatureFlags` but had **no entry point and no
> country/city seeding**, so it silently ran nothing (0 rows). Added
> `seedCountries` (upserts 250 countries from `country-reference.json`, clamps
> negative `areaKm2` for the DB `countries_area_check` constraint, derives
> `flagSvgUrl` from flagcdn), `seedCities` (210 capital cities derived from the
> country reference since `city-reference.json` is absent), and a `main()` entry
> point. Seed now converges: 4 users, 250 countries, 210 cities, 6 feature
> flags. API typecheck 0 errors, lint clean, 33 tests pass. Auth E2E through
> register → login → session still to be driven (Phase 2/3).
>
> **Phase 2 (commit `a47d1b9`): API verified against live Postgres/Redis.**
> First real boot of the API surfaced and fixed **four first-boot bugs**:
> (1) `env.schema.ts` `optionalString` rejected empty values from
> `.env.example`, so copying the example verbatim crashed boot (now transforms
> `''` → `undefined` before the `min(1)` pipe); (2) `ZodValidationPipe`'s
> optional constructor param was typed as an interface and Nest treated it as an
> injectable token — "Nest can't resolve dependencies" (marked `@Optional()`);
> (3) HEADER versioning in `main.ts` required `x-api-version` even though
> `defaultVersion: '1'` was set — Nest only falls back to the default for
> `VERSION_NEUTRAL`, so every curl/web request 404'd (added a middleware that
> defaults the header to `1`); (4) `token.service.ts` `mint()` put `jti` in the
> payload AND passed `jwtid` to `signAsync`, which jsonwebtoken rejects
> ("Bad options.jwtid") — dropped the option. After fixes, the full flow works
> against live Postgres: register 201 (fresh email `e2e2@test.dev`, session
> tokens returned, refresh cookie set HttpOnly+SameSite=Lax), login 200,
> `/auth/me` 200 with Bearer, `/auth/refresh` 200 via cookie, logout 204, wrong
> password 401, seeded admin login 200, `/admin/overview` 200 for admin but 403
> for a plain user (role guard works), `/cities` returns live DB rows. 33 API
> tests, lint, typecheck all still green.

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

1. ~~**Tests**~~ — DONE (`5a627eb`): 168 tests across all three workspaces —
   shared (utils + zod schemas, vitest), API (crypto/totp/pagination/health,
   Jest), web (api client + Badge, vitest+jsdom). CI now runs the test step.
2. ~~**CI + deploy artifacts**~~ — DONE (`4abb379`): GitHub Actions workflow,
   Dockerfiles for both apps, nginx reverse proxy, prod compose stack. Not
   build-tested here (no Docker CLI in this environment).
3. ~~**Auth end-to-end verification**~~ — **DONE** (commits `3303bef`, `a47d1b9`,
   `5fedcd3`): live Postgres 15 + Redis, seed converging, four first-boot bugs
   fixed, register → login → me → refresh → logout → role guard verified via
   HTTP, and the web UI pass (Playwright 9/9) confirmed register → login →
   session through the browser. Access token now mirrors into an `edt_access`
   cookie so user-scoped endpoints work from the browser.
4. **More 2D map layers** (~26 left) — wired so far: ocean currents, place
   labels, aurora, satellites. Remaining candidates need heavier sources:
   submarine cables (TeleGeography data path on GitHub changed → 404),
   power grid (OpenInfraMap tiles blocked), population/urban (WorldPop/GHSL,
   no keyless tiles), transit (OSM/Transitland vector tiles), forest cover /
   protected areas (GFW/WDPA), timezones (large GeoJSON), lightning (premium),
   live traffic (key), tsunami, bathymetry.
5. ~~**Live 40k-city gazetteer**~~ — `/cities/[id]` was rendering from the bundled
   curated list; now **DONE** (commit `6359ae9`): the web tier calls the gazetteer API
   via `/api` (list + `by-slug`), all 210 seeded capitals with real populations
   (Open-Meteo geocoding fallback) render, curated list remains the offline
   fallback. The full ~40k-city expansion still waits on Wikidata SPARQL
   (`build-city-index.mjs`) or a keyed source.
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
npm run test      --workspaces --if-present   # 168 tests across shared/api/web
```

`npm run prisma:generate --workspace @edt/api` must run before `build:api` /
API `typecheck` after a fresh `npm ci` (no postinstall hook — see gotchas).

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
`/cities/[id]` resolves any seeded city against the live gazetteer API
(`getCityByIdentifier` → `by-slug`) and calls `notFound()` for unknown ids,
mirroring the existing country route.

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

1. **Auth is unverified end-to-end.** Forms exist and typecheck, but no one
   has run the API against a live Postgres and clicked through
   register → login → session yet.

## Done since the last checkpoint

- **Tests milestone 5 (commit `5a627eb`).** First test suite in the repo: 168
  tests across shared / api / web. `packages/shared` gained vitest +
  `vitest.config.ts` + specs for `geo`, `color`, `format`, `scales` and the
  `common`/`auth` zod schemas (specs excluded from the tsc build via
  `tsconfig` `exclude`). `apps/api` gained Jest specs for `crypto.util`
  (encrypt/decrypt, base32 RFC 4648 vectors), `totp.util` (RFC 4226 HOTP /
  RFC 6238 vectors, drift window, recovery codes), `pagination` and a
  `HealthController` suite with mocked Prisma/Redis/Upstream. `apps/web`
  gained `vitest.config.ts` (jsdom + `esbuild.jsx: automatic` + `@/` alias —
  needed because the web tsconfig uses `jsx: preserve`) and specs for
  `lib/api/client` (envelope unwrap, buildQuery, ApiError, apiMaybe,
  describeError) and `Badge`/`LiveBadge`. CI `ci.yml` now runs
  `npm run test --workspaces --if-present` between typecheck and build.
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

1. ~~**Live city gazetteer.**~~ **DONE** — web wired to the gazetteer API; 210
   seeded capitals with real populations. Full ~40k expansion blocked on
   Wikidata SPARQL availability.
2. **More 2D map layers.** Remaining catalogue layers need heavier sources
   (submarine cables, power grid, population rasters, timezones, live traffic
   — most keyed/premium or blocked upstream); lower priority than auth.
3. **Remaining API polish.** API is ~95%; audit the last ~5% (endpoints not yet
   exercised against live Postgres/Redis) now that the stack is fully up.

## Deviations from the original brief

- **No FastAPI service.** AI lives in the Nest `ai` module.
- **MapLibre GL + react-three-fiber, not CesiumJS.** That is what `apps/web`
  declares as dependencies.

## Gotchas worth remembering

- **Web vitest needs `esbuild.jsx: automatic`.** The web tsconfig uses
  `jsx: preserve` (Next.js default), which vitest's esbuild will not transform
  to the automatic runtime — every `*.tsx` spec fails with "React is not
  defined" unless `esbuild: { jsx: 'automatic' }` is in `vitest.config.ts`.
  Also add a `resolve.alias` for `@/` → `./src` and `setupFiles` importing
  `@testing-library/jest-dom/vitest`.
- **Shared specs must be excluded from the tsc build.** `packages/shared`
  compiles with `rootDir: ./src`, so any `*.spec.ts` would otherwise land in
  `dist/`. `tsconfig.json` excludes `src/**/*.spec.ts`; vitest still finds
  them via its own include glob.
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
- **Wikidata SPARQL is unreliable from this environment** (frequent 504 / query
  timeouts). The 40k-city gazetteer builder (`build-city-index.mjs`) depends on
  it; the keyless fallback `build-city-index-openmeteo.mjs` derives the 210
  capital cities via the Open-Meteo geocoding API instead (same source the API
  already attributes). Both write `apps/web/src/lib/data/city-reference.json`,
  which the Prisma seed reads if present — rerun `npm run build:city-index`
  (Wikidata) or `build:city-index:openmeteo`, then `npm run db:seed`, to refresh
  city populations.
- Delegating a broad task to a sub-agent can significantly overshoot the
  stated scope (asked for 4 pages, got ~23). Review the diff before assuming
  the scope matches the ask, even if typecheck/lint/build all pass.
