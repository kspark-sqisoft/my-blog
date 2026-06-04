import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { convertMarkdownToHtml } from '../src/publishing/markdown-to-html';

// T-INFRA-303: 일회성 마이그레이션. 모든 Post 의 contentMarkdown 을 sanitize 통과 HTML 로
// 변환해 contentHtml 컬럼을 채운다. 같은 입력은 같은 결과 — 멱등.
//
// 실행: DATABASE_URL=... pnpm --filter api migrate:md-to-html [--dry-run]
//
// dry-run: 변환 결과를 콘솔에 미리 보여주기만 하고 DB 는 건드리지 않는다.
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 환경변수가 필요합니다.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let scanned = 0;
  let changed = 0;
  let skipped = 0;

  try {
    const posts = await prisma.post.findMany({
      select: {
        id: true,
        title: true,
        contentMarkdown: true,
        contentHtml: true,
      },
    });
    for (const p of posts) {
      scanned += 1;
      const target = convertMarkdownToHtml(p.contentMarkdown);
      if (target === p.contentHtml) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] ${p.id} (${p.title}) → ${target.length} chars`);
        changed += 1;
        continue;
      }
      await prisma.post.update({
        where: { id: p.id },
        data: { contentHtml: target },
      });
      console.log(`[ok] ${p.id} (${p.title}) → ${target.length} chars`);
      changed += 1;
    }
    console.log(
      `\n[migrate:md-to-html] 결과: scanned=${scanned}, changed=${changed}, skipped=${skipped}${dryRun ? ' (dry-run)' : ''}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
