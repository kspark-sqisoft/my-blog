import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { slugify } from '../src/publishing/slugify';

// ADR-0022: 기존 글 slug 백필. add_post_slug 마이그레이션이 임시로 slug=id 를 넣어두었으므로,
// slug 가 아직 id 와 같은(=미백필) 글만 제목 기반 유일 슬러그로 교체한다. 두 번 실행해도 멱등.
//
// 실행: DATABASE_URL=... pnpm --filter api backfill:slugs [--dry-run]
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
      select: { id: true, slug: true, title: true },
      orderBy: { createdAt: 'asc' },
    });
    // 이미 확정된(백필된) 슬러그는 충돌 회피 집합에 미리 넣는다.
    const taken = new Set(
      posts.filter((p) => p.slug !== p.id).map((p) => p.slug),
    );

    for (const p of posts) {
      scanned += 1;
      if (p.slug !== p.id) {
        skipped += 1; // 이미 가독 슬러그 → 멱등 스킵
        continue;
      }
      const base = slugify(p.title);
      let candidate = base;
      let n = 1;
      while (taken.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      taken.add(candidate);
      changed += 1;
      console.log(`[${dryRun ? 'dry' : 'ok'}] ${p.id} → ${candidate}`);
      if (!dryRun) {
        await prisma.post.update({
          where: { id: p.id },
          data: { slug: candidate },
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `\n[backfill:slugs] 결과: scanned=${scanned}, changed=${changed}, skipped=${skipped}`,
  );
}

void main();
