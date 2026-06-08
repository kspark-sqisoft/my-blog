import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { seedOperator } from './../src/auth/seed-operator';

// 절대규칙 #8: DATABASE_URL 은 jest-e2e.setup 이 blog_test 로 강제한다(여기서 설정 금지).
describe('SEO feed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let authorId: string;

  const email = 'seo-feed-e2e@example.com';
  const password = 'secret123';

  function accessCookie(setCookie: unknown): string {
    const arr: string[] = Array.isArray(setCookie)
      ? (setCookie as string[])
      : [];
    return arr.find((c) => c.startsWith('access_token=')) ?? '';
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    configureApp(app);
    await app.init();

    const user = await seedOperator(prisma, { email, password });
    authorId = user.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    cookie = accessCookie(login.headers['set-cookie']);
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('GET /feed.xml → 200 + application/rss+xml + Cache-Control, 발행글 포함·초안 제외', async () => {
    const server = app.getHttpServer();

    // 발행글 1건
    const pub = await request(server)
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({
        title: '발행글 피드 항목',
        contentHtml: '<p>발행 본문입니다.</p>',
        tags: [],
      })
      .expect(201);
    await request(server)
      .post(`/api/posts/${(pub.body as { id: string }).id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    // 초안 1건(미발행)
    await request(server)
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({
        title: '초안 피드 항목',
        contentHtml: '<p>초안 본문.</p>',
        tags: [],
      })
      .expect(201);

    const res = await request(server).get('/feed.xml').expect(200);
    expect(res.headers['content-type']).toContain('application/rss+xml');
    expect(res.headers['cache-control']).toContain('max-age');
    expect(res.text).toContain('<rss');
    expect(res.text).toContain('<dc:creator>');
    expect(res.text).toContain('발행글 피드 항목');
    expect(res.text).not.toContain('초안 피드 항목');
  });
});
