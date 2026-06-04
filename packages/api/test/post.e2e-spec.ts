import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { seedOperator } from './../src/auth/seed-operator';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';
process.env.JWT_SECRET ??= 'test-secret';

describe('PostController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authorId: string;
  let cookie: string;

  const email = 'post-e2e@example.com';
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

  const newPost = { title: '글', contentMarkdown: '# 본문', tags: ['nestjs'] };

  it('미인증 쓰기는 401 (POST/DELETE/publish)', async () => {
    await request(app.getHttpServer())
      .post('/api/posts')
      .send(newPost)
      .expect(401);
    await request(app.getHttpServer()).delete('/api/posts/x').expect(401);
    await request(app.getHttpServer()).post('/api/posts/x/publish').expect(401);
  });

  it('운영자 create → 201, DRAFT + authorId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send(newPost)
      .expect(201);
    const body = res.body as { id: string; status: string; authorId: string };
    expect(body.status).toBe('DRAFT');
    expect(body.authorId).toBe(authorId);
    expect(body.id).toBeTruthy();
  });

  it('공개 GET /api/posts는 발행글만 페이지네이션으로 반환', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send(newPost)
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/posts/${id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/posts?page=1&pageSize=10')
      .expect(200);
    const body = res.body as {
      items: { id: string; authorName: string }[];
      total: number;
    };
    expect(body.items.map((p) => p.id)).toContain(id);
    expect(body.total).toBeGreaterThanOrEqual(1);
    // 목록 항목에 작성자 이름이 포함된다 (ADR-0017). seed email 로컬파트 = 'post-e2e'
    const mine = body.items.find((p) => p.id === id);
    expect(mine?.authorName).toBe('post-e2e');
  });

  it('공개 GET /api/posts/:id — 발행 200, 초안 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send(newPost)
      .expect(201);
    const id = (created.body as { id: string }).id;

    // 초안 상태 → 404
    await request(app.getHttpServer()).get(`/api/posts/${id}`).expect(404);

    await request(app.getHttpServer())
      .post(`/api/posts/${id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/posts/${id}`)
      .expect(200);
    const detail = res.body as { status: string; authorName: string };
    expect(detail.status).toBe('PUBLISHED');
    expect(detail.authorName).toBe('post-e2e'); // ADR-0017
  });

  it('운영자 DELETE → 204', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send(newPost)
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .delete(`/api/posts/${id}`)
      .set('Cookie', cookie)
      .expect(204);
  });
});
