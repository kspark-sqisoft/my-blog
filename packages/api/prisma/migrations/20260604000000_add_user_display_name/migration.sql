-- 작성자 표시 이름 추가 (ADR-0017)
-- 기존 행이 있을 수 있으므로 nullable 추가 → email 로컬파트로 백필 → NOT NULL 순으로 적용한다.

-- 1) nullable 컬럼 추가
ALTER TABLE "users" ADD COLUMN "name" TEXT;

-- 2) 기존 행 백필: email 의 '@' 앞부분을 표시 이름으로
UPDATE "users" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL;

-- 3) NOT NULL 제약 부여
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
