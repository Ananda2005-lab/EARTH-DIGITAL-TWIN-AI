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
