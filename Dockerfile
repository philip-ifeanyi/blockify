# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.25.0
WORKDIR /app

# Install the web app's dependency graph (including the workspace core package).
# Only manifests are copied first, so this layer is cached until dependencies change.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter "@blockify/web..."

# Build the Next.js standalone server. "prebuild" copies the face models into public/models.
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY apps/web ./apps/web
RUN pnpm --filter @blockify/web build

# The standalone output already contains the minimal node_modules it traced, so the runtime
# image needs no package manager or install step.
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
