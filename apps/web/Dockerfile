# Earth Digital Twin AI — web image.
#
# Build context is the repository root (npm workspaces monorepo), e.g.:
#   docker build -f apps/web/Dockerfile -t edt-web .

# ── Dependencies ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Build shared + web ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm run build:shared && npm run build --workspace @edt/web

# ── Runtime ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web ./apps/web
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@edt/web"]
