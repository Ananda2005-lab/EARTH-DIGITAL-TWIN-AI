<<<<<<< HEAD
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t edt-api .

# ---- deps: install every workspace needs ----------------------------------
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @edt/shared --workspace @edt/api --include-workspace-root

# ---- build: shared first, then prisma client, then nest --------------------
FROM deps AS build
WORKDIR /repo
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build:shared \
  && npm run prisma:generate --workspace @edt/api \
  && npm run build:api

# ---- runtime ----------------------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S edt && adduser -S edt -G edt

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/prisma ./prisma

USER edt
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
# Migrations are applied before boot so the image always matches the schema it was built against.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
=======
# Earth Digital Twin AI — API image.
#
# Build context is the repository root (npm workspaces monorepo), e.g.:
#   docker build -f apps/api/Dockerfile -t edt-api .

# ── Dependencies ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Build shared + api ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# Generate the Prisma client (schema lives in the api app) before compiling.
RUN cd apps/api && npx prisma generate
RUN npm run build:shared && npm run build --workspace @edt/api

# ── Runtime ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
>>>>>>> 005c357b565eaf6ff99b0cc04ff8ed07cf1d64a0
