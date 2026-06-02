#!/usr/bin/env bash
# Playwright E2E 격리 실행 (T-INFRA-005).
# docker-compose.e2e.yml 의 격리 스택(blog_e2e + 전용 api/web)을 띄우고,
# 호스트에서 prisma migrate deploy + 운영자 시드를 실행한 뒤 Playwright 를 돌린다.
# dev 스택(blog)이 동시에 떠 있으면 실행 전/후로 Post/Comment 카운트가
# 변하지 않았음을 검증한다 (격리 회귀 가드). 종료 시 항상 스택을 정리한다.
#
# 사용:
#   pnpm --filter web test:e2e            # 한 명령 (이 스크립트 호출)
#   E2E_KEEP_STACK=1 ./scripts/e2e-isolated.sh   # 디버깅용: down 생략
#
# 인자는 그대로 Playwright 에 전달된다 (예: `... -- --grep operator`).
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

PROJECT="${E2E_COMPOSE_PROJECT:-my-blog-e2e}"
COMPOSE=( docker compose -f docker-compose.e2e.yml -p "$PROJECT" )

E2E_DB_PORT="${E2E_DB_PORT:-5434}"
E2E_API_PORT="${E2E_API_PORT:-3002}"
E2E_WEB_PORT="${E2E_WEB_PORT:-5174}"
E2E_POSTGRES_USER="${E2E_POSTGRES_USER:-blog}"
E2E_POSTGRES_PASSWORD="${E2E_POSTGRES_PASSWORD:-blog}"
E2E_POSTGRES_DB="${E2E_POSTGRES_DB:-blog_e2e}"
E2E_OPERATOR_EMAIL="${E2E_OPERATOR_EMAIL:-owner@example.com}"
E2E_OPERATOR_PASSWORD="${E2E_OPERATOR_PASSWORD:-change-me}"
E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:${E2E_WEB_PORT}}"

KEEP_STACK="${E2E_KEEP_STACK:-0}"

export E2E_DB_PORT E2E_API_PORT E2E_WEB_PORT \
  E2E_POSTGRES_USER E2E_POSTGRES_PASSWORD E2E_POSTGRES_DB

cleanup() {
  local rc=$?
  if [ "$KEEP_STACK" = "1" ]; then
    echo "[e2e] E2E_KEEP_STACK=1 → 격리 스택 유지 (수동 정리: ${COMPOSE[*]} down -v)" >&2
  else
    echo "[e2e] 격리 스택 정리(down -v)" >&2
    "${COMPOSE[@]}" down -v >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap cleanup EXIT

# dev 스택(my-blog)의 db 컨테이너를 식별 — 떠 있을 때만 카운트 비교.
DEV_DB_CONTAINER=$(docker ps \
  --filter "label=com.docker.compose.project=my-blog" \
  --filter "label=com.docker.compose.service=db" \
  --format '{{.Names}}' | head -n1 || true)

DEV_BEFORE=""
if [ -n "$DEV_DB_CONTAINER" ]; then
  echo "[e2e] dev DB($DEV_DB_CONTAINER) 발견 — 실행 전 카운트 스냅샷"
  DEV_BEFORE=$(docker exec "$DEV_DB_CONTAINER" psql -At -U blog -d blog -c \
    "SELECT (SELECT count(*) FROM posts)::text || ':' || (SELECT count(*) FROM comments)::text" \
    2>/dev/null || echo "?:?")
  echo "[e2e]   before(Post:Comment) = $DEV_BEFORE"
else
  echo "[e2e] dev DB 미기동 — 영향 비교 단계는 건너뜀(스킵)"
fi

echo "[e2e] (0/6) Playwright 브라우저 확인(필요 시 chromium 다운로드)"
pnpm --filter web exec playwright install chromium >/dev/null

echo "[e2e] (1/6) 격리 db 컨테이너 기동 + healthy 대기"
"${COMPOSE[@]}" up -d --build --wait db

export DATABASE_URL="postgresql://${E2E_POSTGRES_USER}:${E2E_POSTGRES_PASSWORD}@127.0.0.1:${E2E_DB_PORT}/${E2E_POSTGRES_DB}?schema=public"

echo "[e2e] (2/6) prisma migrate deploy → ${E2E_POSTGRES_DB}"
pnpm --filter api exec prisma migrate deploy

echo "[e2e] (3/6) 운영자 시드 (${E2E_OPERATOR_EMAIL})"
OPERATOR_EMAIL="$E2E_OPERATOR_EMAIL" OPERATOR_PASSWORD="$E2E_OPERATOR_PASSWORD" \
  pnpm --filter api db:seed

echo "[e2e] (4/6) 격리 api + web 기동 + healthy 대기"
"${COMPOSE[@]}" up -d --build --wait api web

echo "[e2e] (5/6) Playwright 실행 (E2E_BASE_URL=$E2E_BASE_URL)"
PLAYWRIGHT_RC=0
E2E_BASE_URL="$E2E_BASE_URL" \
OPERATOR_EMAIL="$E2E_OPERATOR_EMAIL" \
OPERATOR_PASSWORD="$E2E_OPERATOR_PASSWORD" \
  pnpm --filter web exec playwright test "$@" || PLAYWRIGHT_RC=$?

if [ -n "$DEV_BEFORE" ]; then
  echo "[e2e] (6/6) dev DB($DEV_DB_CONTAINER) 카운트 비교"
  DEV_AFTER=$(docker exec "$DEV_DB_CONTAINER" psql -At -U blog -d blog -c \
    "SELECT (SELECT count(*) FROM posts)::text || ':' || (SELECT count(*) FROM comments)::text" \
    2>/dev/null || echo "?:?")
  echo "[e2e]   after (Post:Comment) = $DEV_AFTER"
  if [ "$DEV_BEFORE" != "$DEV_AFTER" ]; then
    echo "[e2e] ❌ dev DB(blog) 카운트가 변경되었습니다 (격리 위반)" >&2
    exit 2
  fi
  echo "[e2e] ✅ dev DB 영향 없음"
else
  echo "[e2e] (6/6) dev DB 비교 생략"
fi

exit "$PLAYWRIGHT_RC"
