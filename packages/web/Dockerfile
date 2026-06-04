# syntax=docker/dockerfile:1
# React(Vite) 웹 멀티스테이지 빌드 (pnpm workspace)
# build context = 저장소 루트

# ---- base: 워크스페이스 의존성 설치 ----
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ---- dev: Vite 핫리로드 (소스는 compose 볼륨으로 마운트) ----
FROM base AS dev
WORKDIR /repo/packages/web
EXPOSE 5173
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- build: shared 빌드 + 정적 산출물 생성 ----
FROM base AS build
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
# shared 의 dist 가 있어야 vite 빌드 시 value import(richHtmlSchema 등, ADR-0021) resolve 가능
RUN pnpm --filter @blog/shared build
WORKDIR /repo/packages/web
RUN pnpm run build

# ---- prod: nginx로 정적 산출물만 서빙 (/api 는 api로 프록시) ----
FROM nginx:alpine AS prod
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/packages/web/dist /usr/share/nginx/html
EXPOSE 80
