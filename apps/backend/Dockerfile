# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build
COPY packages/shared/src/ packages/shared/src/
COPY apps/backend/src/ apps/backend/src/
COPY apps/backend/tsconfig.json apps/backend/
COPY apps/backend/drizzle.config.ts apps/backend/
WORKDIR /app/apps/backend
RUN pnpm build

# Stage 3: Production
FROM node:22-alpine AS production
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/apps/backend/dist/ apps/backend/dist/

EXPOSE 8000
CMD ["node", "apps/backend/dist/index.js"]
