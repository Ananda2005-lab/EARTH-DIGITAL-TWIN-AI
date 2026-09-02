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
