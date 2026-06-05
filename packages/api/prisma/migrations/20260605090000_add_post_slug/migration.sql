-- ADR-0022: Post.slug (URL 슬러그). 기존 행이 있어 안전 절차로 추가한다.
-- 1) nullable 로 컬럼 추가
ALTER TABLE "posts" ADD COLUMN "slug" TEXT;

-- 2) 기존 행에 유일한 임시값(=id) 백필 → 이후 title→slug 백필 스크립트가 가독 슬러그로 교체
UPDATE "posts" SET "slug" = "id" WHERE "slug" IS NULL;

-- 3) NOT NULL + 유니크 인덱스
ALTER TABLE "posts" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");
