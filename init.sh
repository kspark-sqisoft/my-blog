#!/usr/bin/env bash
# my-blog 환경 부트스트랩 & 헬스체크.
# 매 세션 시작 시 `bash init.sh` 로 실행. 하나라도 실패하면 즉시 종료(비0).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# 127.0.0.1 고정: localhost 가 IPv6(::1)로 풀리면 Prisma CLI 엔진이 못 붙는 경우가 있다.
DB_URL="${DATABASE_URL:-postgresql://blog:blog@127.0.0.1:5433/blog?schema=public}"
DB_CONTAINER="my-blog-db-1"

fail() { echo "[init] ❌ $1" >&2; exit 1; }
ok()   { echo "[init] ✅ $1"; }

# 1) 필수 도구
command -v node   >/dev/null 2>&1 || fail "node 미설치"
command -v pnpm   >/dev/null 2>&1 || fail "pnpm 미설치 (corepack enable)"
command -v docker >/dev/null 2>&1 || fail "docker 미설치/미실행"
ok "도구 확인 (node $(node -v), pnpm $(pnpm -v))"

# 2) 워크스페이스 의존성
if [ ! -d node_modules ] || [ ! -d packages/api/node_modules ]; then
  echo "[init] 의존성 설치 중 ..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
fi
ok "의존성 설치됨"

# 2-b) @blog/shared 빌드 — api(CJS)는 shared 를 dist(빌드 산출물)로 해석한다.
# dist 는 gitignore 라 머지/풀로 소스만 바뀌면 stale 이 된다 → api 컴파일 깨짐(502). 매 부트스트랩에 최신화.
pnpm --filter @blog/shared run build >/dev/null 2>&1 || fail "@blog/shared 빌드 실패"
ok "@blog/shared 빌드(dist 최신화)"

# 3) PostgreSQL 컨테이너 기동 + healthy 대기
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db >/dev/null 2>&1 \
  || fail "db 컨테이너 기동 실패 (docker 실행 여부 확인)"
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo none)"
  [ "$status" = "healthy" ] && break
  sleep 2
done
[ "$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo none)" = "healthy" ] \
  || fail "db healthy 대기 초과"
ok "PostgreSQL healthy (localhost:5433)"

# 4) Prisma 클라이언트 생성 + 마이그레이션 적용
export DATABASE_URL="$DB_URL"
( cd packages/api && pnpm exec prisma generate >/dev/null 2>&1 ) || fail "prisma generate 실패"
( cd packages/api && pnpm exec prisma migrate deploy >/dev/null 2>&1 ) || fail "prisma migrate deploy 실패"
ok "Prisma 클라이언트·마이그레이션 적용"

# 4-b) 테스트 전용 DB (blog_test) — 개발 DB 오염 없이 결정적 테스트
docker exec "$DB_CONTAINER" psql -U "${POSTGRES_USER:-blog}" -d "${POSTGRES_DB:-blog}" \
  -tc "SELECT 1 FROM pg_database WHERE datname='blog_test'" 2>/dev/null | grep -q 1 \
  || docker exec "$DB_CONTAINER" psql -U "${POSTGRES_USER:-blog}" -d "${POSTGRES_DB:-blog}" \
       -c "CREATE DATABASE blog_test" >/dev/null 2>&1 || true
TEST_DB_URL="postgresql://${POSTGRES_USER:-blog}:${POSTGRES_PASSWORD:-blog}@127.0.0.1:5433/blog_test?schema=public"
( cd packages/api && DATABASE_URL="$TEST_DB_URL" pnpm exec prisma migrate deploy >/dev/null 2>&1 ) \
  || fail "blog_test 마이그레이션 실패"
ok "테스트 DB(blog_test) 준비"

# 5) 요약
echo ""
echo "[init] 환경 준비 완료 ✅"
echo "  DATABASE_URL = $DB_URL"
echo "  api 개발:  pnpm --filter api start:dev"
echo "  api 검증:  pnpm --filter api lint / test / test:e2e"
echo "  web 개발:  pnpm --filter web dev"
echo "  운영자 시드: DATABASE_URL=$DB_URL OPERATOR_EMAIL=.. OPERATOR_PASSWORD=.. pnpm --filter api db:seed"
