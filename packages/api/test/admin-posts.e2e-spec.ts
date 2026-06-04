import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { PostService } from './../src/publishing/post.service';
import { seedOperator } from './../src/auth/seed-operator';

process.env.JWT_SECRET ??= 'test-secret';

describe('AdminPostController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let posts: PostService;
  let authorId: string; // 시드 운영자(ADMIN)
  let cookie: string; // ADMIN 쿠키
  let authorUserId: string; // 일반 작성자(AUTHOR)
  let authorCookie: string; // AUTHOR 쿠키

  const email = 'admin-list-e2e@example.com';
  const password = 'secret123';
  const authorEmail = 'admin-list-author-e2e@example.com';
  const authorPw = 'authorpw1';

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
    posts = moduleRef.get(PostService);
    configureApp(app);
    await app.init();

    const user = await seedOperator(prisma, { email, password });
    authorId = user.id;
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    cookie = accessCookie(login.headers['set-cookie']);

    // 일반 작성자(AUTHOR) 준비 (ADR-0019: 가입자가 곧 작성자)
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    const author = await prisma.user.create({
      data: {
        email: authorEmail,
        passwordHash: await bcrypt.hash(authorPw, 10),
        name: '작성자',
        role: 'AUTHOR',
      },
    });
    authorUserId = author.id;
    const authorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: authorEmail, password: authorPw })
      .expect(200);
    authorCookie = accessCookie(authorLogin.headers['set-cookie']);
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({
      where: { authorId: { in: [authorId, authorUserId] } },
    });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({
      where: { authorId: { in: [authorId, authorUserId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [email, authorEmail] } },
    });
    await app.close();
  });

  it('미인증 → 401', () => {
    return request(app.getHttpServer()).get('/api/admin/posts').expect(401);
  });

  it('운영자 → 초안+발행 모두 status 포함해 반환', async () => {
    const draft = await posts.create({
      title: '초안 글',
      contentMarkdown: 'd',
      authorId,
    });
    const pub = await posts.create({
      title: '발행 글',
      contentMarkdown: 'p',
      authorId,
    });
    await posts.publish(pub.id, { id: authorId, role: 'ADMIN' });

    const res = await request(app.getHttpServer())
      .get('/api/admin/posts?page=1&pageSize=10')
      .set('Cookie', cookie)
      .expect(200);
    const body = res.body as {
      items: { id: string; status: string }[];
      total: number;
    };
    const byId = new Map(body.items.map((p) => [p.id, p.status]));
    expect(byId.get(draft.id)).toBe('DRAFT');
    expect(byId.get(pub.id)).toBe('PUBLISHED');
  });

  it('단건: 미인증 → 401', () => {
    return request(app.getHttpServer())
      .get('/api/admin/posts/some-id')
      .expect(401);
  });

  it('단건: 운영자 → 초안도 contentMarkdown·status 포함 반환', async () => {
    const draft = await posts.create({
      title: '편집할 초안',
      contentMarkdown: '# 편집 본문',
      authorId,
      tags: ['edit'],
    });
    const res = await request(app.getHttpServer())
      .get(`/api/admin/posts/${draft.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const body = res.body as {
      id: string;
      status: string;
      contentMarkdown: string;
    };
    expect(body.id).toBe(draft.id);
    expect(body.status).toBe('DRAFT');
    expect(body.contentMarkdown).toContain('# 편집 본문');
  });

  it('단건: 없는 id → 404', () => {
    return request(app.getHttpServer())
      .get('/api/admin/posts/no-such')
      .set('Cookie', cookie)
      .expect(404);
  });

  // ADR-0019: 목록/상세를 actor로 스코프 — AUTHOR 본인 글만, ADMIN 전체
  it('AUTHOR → 본인 글만 보이고 타인(ADMIN) 글은 목록에서 제외', async () => {
    const adminPost = await posts.create({
      title: 'ADMIN 글',
      contentMarkdown: 'a',
      authorId,
    });
    const mine = await posts.create({
      title: 'AUTHOR 글',
      contentMarkdown: 'm',
      authorId: authorUserId,
    });

    const res = await request(app.getHttpServer())
      .get('/api/admin/posts?page=1&pageSize=50')
      .set('Cookie', authorCookie)
      .expect(200);
    const body = res.body as { items: { id: string }[]; total: number };
    const ids = body.items.map((p) => p.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(adminPost.id);
  });

  it('단건: AUTHOR가 타인 글을 열면 403, 본인 글은 200', async () => {
    const adminDraft = await posts.create({
      title: 'ADMIN 초안',
      contentMarkdown: 'a',
      authorId,
    });
    const myDraft = await posts.create({
      title: 'AUTHOR 초안',
      contentMarkdown: 'm',
      authorId: authorUserId,
    });

    await request(app.getHttpServer())
      .get(`/api/admin/posts/${adminDraft.id}`)
      .set('Cookie', authorCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/admin/posts/${myDraft.id}`)
      .set('Cookie', authorCookie)
      .expect(200);
  });
});
