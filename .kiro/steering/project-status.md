# Earth Digital Twin AI — build status

Living checkpoint so a new session can resume without re-deriving context.
Update this file whenever a milestone lands.

_Last verified: 2026-08-02_

## Shape of the repo

npm workspaces monorepo, `@edt/*` scope.

| Workspace          | Package       | State                                                  |
| ------------------ | ------------- | ------------------------------------------------------ |
| `packages/shared`  | `@edt/shared` | Done — types, Zod schemas, constants, utils. Builds.   |
| `apps/api`         | `@edt/api`    | Substantially complete (131 files). Builds, lints, typechecks. |
| `apps/web`         | `@edt/web`    | Config + data providers only. No UI yet.               |
| `scripts`          | —             | Two gazetteer index builders.                          |

## Verified commands

Run from the repo root unless noted.

```
npm run build:shared      # tsc, passes
npm run build:api         # nest build, passes
npm run lint  --workspace @edt/api    # 0 errors, 0 warnings
npm run typecheck --workspace @edt/api # 0 errors, ~6s
npm run test  --workspace @edt/api    # passes, but there are no tests yet
```

`npm run build:web` is expected to fail: `apps/web/src/app` has no `layout.tsx`
or `page.tsx`.

## API — what exists

22 Nest modules under `apps/api/src/modules`:

admin, ai, analytics, auth, bookmarks, cities, countries, environment, flights,
hazards, health, jobs, notifications, preferences, reports, search, ships,
ships-relay, space, users, weather, workspaces.

Cross-cutting wiring is global in `app.module.ts`: Zod validation pipe, response
envelope + error filter, Redis response cache, audit interceptor, JWT / roles /
permissions / maintenance guards, throttler, request-id middleware, pino logging,
BullMQ, scheduler.

Prisma schema: 35 models, 30 enums, one migration (`0001_init`), seed script.

## Not started / missing

Ordered roughly by what blocks the most.

1. **Frontend.** Every page and component. `apps/web/src/app` holds only
   `globals.css`; `src/lib` and `src/server/providers` are the only real code.
2. **Tests.** Zero spec files in any workspace.
3. **Infra.** Root `package.json` references `infra/docker/docker-compose.yml`;
   the `infra/` directory does not exist. No Dockerfiles, no Nginx config, no
   GitHub Actions workflows.
4. **Env template.** No `.env.example`, so required config is undocumented
   outside `src/config/env.schema.ts`.
5. **Docs.** No README.
6. **Git.** Not initialized.

## Deviations from the original brief

Deliberate or inherited; decide before building on top of them.

- **No FastAPI service.** AI lives in the Nest `ai` module instead of a separate
  Python app.
- **MapLibre GL + react-three-fiber, not CesiumJS.** That is what `apps/web`
  declares as dependencies.

## Gotchas worth remembering

- **Keep `zod` on a single version.** The root `package.json` has an
  `overrides` entry for it. Two copies (one hoisted, one nested under
  `packages/shared`) made every controller trip `TS2589` and drove `tsc` to
  exhaust an 8 GB heap. If typechecking suddenly hangs or OOMs, check for a
  duplicate `zod` install first.
- **ESLint config is `.eslintrc.cjs`, not JSON,** because
  `parserOptions.tsconfigRootDir` has to be an absolute path (`__dirname`).
- Repo-wide Prettier drift: `npm run format:check` flags ~150 files that were
  never formatted. Running `npm run format` fixes it but touches a lot at once.
