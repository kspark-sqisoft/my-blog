import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { PostService } from './../src/publishing/post.service';
import { seedOperator } from './../src/auth/seed-operator';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('TagController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let posts: PostService;
  let authorId: string;

  const email = 'tag-e2e@example.com';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    posts = moduleRef.get(PostService);
    configureApp(app);
    await app.init();
    const user = await seedOperator(prisma, { email, password: 'x' });
    authorId = user.id;
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('GET /api/tags (공개) → 발행 Post 사용 태그 + postCount, 미사용 제외', async () => {
    const p1 = await posts.create({
      title: 'p1',
      contentMarkdown: 'x',
      authorId,
      tags: ['x', 'y'],
    });
    const p2 = await posts.create({
      title: 'p2',
      contentMarkdown: 'x',
      authorId,
      tags: ['x'],
    });
    await posts.create({
      title: 'draft',
      contentMarkdown: 'x',
      authorId,
      tags: ['z'], // 초안에만 쓰인 태그 → 제외 대상
    });
    await posts.publish(p1.id);
    await posts.publish(p2.id);

    const res = await request(app.getHttpServer()).get('/api/tags').expect(200);
    const body = res.body as { name: string; postCount: number }[];
    const byName = new Map(body.map((t) => [t.name, t.postCount]));

    expect(byName.get('x')).toBe(2);
    expect(byName.get('y')).toBe(1);
    expect(byName.has('z')).toBe(false); // 초안 전용 태그는 제외
  });
});
