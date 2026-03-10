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
COPY apps/frontend/src/ apps/frontend/src/
COPY apps/frontend/public/ apps/frontend/public/
COPY apps/frontend/index.html apps/frontend/
COPY apps/frontend/tsconfig.json apps/frontend/
COPY apps/frontend/tsconfig.app.json apps/frontend/
COPY apps/frontend/tsconfig.node.json apps/frontend/
COPY apps/frontend/vite.config.ts apps/frontend/
COPY apps/frontend/components.json apps/frontend/
WORKDIR /app/apps/frontend
RUN pnpm build

# Stage 3: Nginx
FROM nginx:alpine AS production
COPY --from=build /app/apps/frontend/dist/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
