#!/usr/bin/env bash
# 격리 git worktree 생성 (가이드 12.8). 병렬/격리 작업용.
#   사용법: bash scripts/worktree-new.sh <name>     예) bash scripts/worktree-new.sh feat-like
# 결과: ../my-blog-wt-<name> 디렉터리 + 브랜치 wt/<name>.
# 주의: 단일 개발자 1트랙이면 보통 불필요(가이드도 advanced 로 분류). 동시 작업이 필요할 때만.
set -euo pipefail

NAME="${1:?사용법: bash scripts/worktree-new.sh <name> (예: feat-like)}"
BRANCH="wt/${NAME}"
DIR="../my-blog-wt-${NAME}"

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "이미 존재하는 브랜치: ${BRANCH}" >&2
  exit 1
fi

git fetch origin --quiet 2>/dev/null || true
git worktree add "$DIR" -b "$BRANCH"

cat <<EOF

[worktree] 생성 완료
  디렉터리: $DIR
  브랜치:   $BRANCH

다음 단계:
  1) cd $DIR
  2) bash init.sh                      # 의존성 / Prisma / 헬스체크
  3) (DB 격리, 권장) dev DB(blog) 충돌을 피하려면 이 worktree 전용 DB 를 쓴다:
       - 별도 DB 생성: psql ... -c "CREATE DATABASE blog_${NAME}"
       - 이 worktree 의 .env 에서 DATABASE_URL 을 .../blog_${NAME} 로 지정
       - pnpm --filter api exec prisma migrate deploy
     (자세한 배경은 docs/harness.md, ADR-0011 Docker dev override)
  4) 작업·커밋·PR 후 메인에서 정리:
       git worktree remove $DIR
       git branch -d $BRANCH            # 머지 완료 시

목록 확인:  git worktree list
EOF
