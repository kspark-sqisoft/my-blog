# syntax=docker/dockerfile:1
# NestJS API 멀티스테이지 빌드 (pnpm workspace)
# build context = 저장소 루트

# ---- base: 워크스페이스 의존성 설치 (레이어 캐시용) ----
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo
# 매니페스트만 먼저 복사해 install 레이어를 캐시한다
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ---- dev: 핫리로드 (소스는 compose 볼륨으로 마운트) ----
FROM base AS dev
WORKDIR /repo/packages/api
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# ---- build: Prisma 생성 + 컴파일 ----
FROM base AS build
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
WORKDIR /repo/packages/api
RUN pnpm exec prisma generate \
 && pnpm run build

# ---- prod-deps: 운영 의존성만 설치 ----
FROM node:24-alpine AS prod-deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --prod

# ---- prod: 빌드 산출물 + 운영 의존성만 담은 런타임 이미지 ----
FROM node:24-alpine AS prod
ENV NODE_ENV=production
WORKDIR /repo/packages/api
# 운영 의존성 (pnpm 심볼릭 링크 보존)
COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=prod-deps /repo/packages/api/node_modules ./node_modules
# 컴파일 산출물과 Prisma 클라이언트
COPY --from=build /repo/packages/api/dist ./dist
COPY --from=build /repo/packages/api/generated ./generated
COPY --from=build /repo/packages/api/prisma ./prisma
COPY --from=build /repo/packages/api/package.json ./package.json
EXPOSE 3000
# nest build 산출물은 tsconfig.build 기준 dist/src/main.js 로 떨어진다.
CMD ["node", "dist/src/main"]
