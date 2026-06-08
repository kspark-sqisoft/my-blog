-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT;

-- CreateIndex
CREATE INDEX "posts_authorId_status_publishedAt_idx" ON "posts"("authorId", "status", "publishedAt");
