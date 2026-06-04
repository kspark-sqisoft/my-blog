-- 다중 사용자 RBAC (ADR-0018): User.role + Comment.userId

-- 1) 역할 enum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AUTHOR', 'MEMBER');

-- 2) User.role 추가 (기본 MEMBER로 즉시 채워짐)
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';

-- 3) 기존 행 백필: 이 마이그레이션 시점의 user는 시드 운영자뿐(ADR-0018 전제) → ADMIN
UPDATE "users" SET "role" = 'ADMIN';

-- 4) Comment.userId (nullable) + FK(SetNull: 사용자 삭제 시 댓글 익명 보존) + index
ALTER TABLE "comments" ADD COLUMN "userId" TEXT;
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "comments_userId_idx" ON "comments"("userId");
