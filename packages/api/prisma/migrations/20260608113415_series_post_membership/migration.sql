-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "seriesOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE INDEX "series_authorId_idx" ON "series"("authorId");

-- CreateIndex
CREATE INDEX "posts_seriesId_seriesOrder_idx" ON "posts"("seriesId", "seriesOrder");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
