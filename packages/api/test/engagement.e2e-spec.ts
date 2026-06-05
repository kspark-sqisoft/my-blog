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

describe('EngagementController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authorId: string;
  let postId: string;
  let draftId: string;
  let cookie: string;

  const authorEmail = 'engagement-e2e@example.com';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    configureApp(app);
    await app.init();

    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
    const post = await prisma.post.create({
      data: {
        slug: `eng-e2e-pub-${Date.now()}`,
        title: 'pub',
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    postId = post.id;
    const draft = await prisma.post.create({
      data: {
        slug: `eng-e2e-draft-${Date.now()}`,
        title: 'draft',
        contentMarkdown: 'x',
        authorId,
      },
    });
    draftId = draft.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: authorEmail, password: 'x' })
      .expect(200);
    const setCookie = login.headers['set-cookie'];
    const cookieArr: string[] = Array.isArray(setCookie) ? setCookie : [];
    cookie = cookieArr.find((c) => c.startsWith('access_token=')) ?? '';
  });

  afterAll(async () => {
    await prisma.like.deleteMany({ where: { post: { authorId } } });
    await prisma.postView.deleteMany({ where: { post: { authorId } } });
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await app.close();
  });

  it('POST /like 비로그인 → 401', () => {
    return request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .expect(401);
  });

  it('POST /like 로그인 → 200 + likeCount 1, likedByMe true (멱등)', async () => {
    const r1 = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .set('Cookie', cookie)
      .expect(200);
    expect(r1.body).toEqual({ likeCount: 1, likedByMe: true });

    // 다시 눌러도 1 (멱등)
    const r2 = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .set('Cookie', cookie)
      .expect(200);
    expect(r2.body).toEqual({ likeCount: 1, likedByMe: true });
  });

  it('DELETE /like 로그인 → 200 + likeCount 0, likedByMe false', async () => {
    const r = await request(app.getHttpServer())
      .delete(`/api/posts/${postId}/like`)
      .set('Cookie', cookie)
      .expect(200);
    expect(r.body).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('POST /view 공개 → 200 + viewCount, 같은 방문자는 30분 dedup', async () => {
    const ua = 'jest-visitor-1';
    const r1 = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/view`)
      .set('User-Agent', ua)
      .expect(200);
    const first = (r1.body as { viewCount: number }).viewCount;
    expect(first).toBeGreaterThanOrEqual(1);

    // 동일 방문자(같은 UA/IP) 재호출 → 증가 없음
    const r2 = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/view`)
      .set('User-Agent', ua)
      .expect(200);
    expect((r2.body as { viewCount: number }).viewCount).toBe(first);

    // 다른 방문자(다른 UA) → 증가
    const r3 = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/view`)
      .set('User-Agent', 'jest-visitor-2')
      .expect(200);
    expect((r3.body as { viewCount: number }).viewCount).toBe(first + 1);
  });

  it('POST /view 미발행 글 → 404', () => {
    return request(app.getHttpServer())
      .post(`/api/posts/${draftId}/view`)
      .set('User-Agent', 'jest-visitor-x')
      .expect(404);
  });

  // T-ENG-004: 상세 응답에 카운트 + likedByMe 노출 (ADR-0024)
  it('GET 상세: 로그인은 likedByMe=true, 비로그인은 false, 카운트 포함', async () => {
    await request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .set('Cookie', cookie)
      .expect(200);

    const mine = await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .set('Cookie', cookie)
      .expect(200);
    const m = mine.body as {
      likedByMe: boolean;
      likeCount: number;
      viewCount: number;
    };
    expect(m.likedByMe).toBe(true);
    expect(m.likeCount).toBeGreaterThanOrEqual(1);
    expect(typeof m.viewCount).toBe('number');

    const anon = await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .expect(200);
    expect((anon.body as { likedByMe: boolean }).likedByMe).toBe(false);
  });
});
