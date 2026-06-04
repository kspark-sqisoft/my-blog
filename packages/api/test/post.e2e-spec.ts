import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './../src/prisma/prisma.service';
import { seedOperator } from './../src/auth/seed-operator';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';
process.env.JWT_SECRET ??= 'test-secret';

describe('PostController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authorId: string;
  let cookie: string; // ADMIN(운영자)
  let memberCookie: string; // MEMBER
  let authorCookie: string; // AUTHOR
  let authorUserId: string;

  const email = 'post-e2e@example.com';
  const password = 'secret123';
  const memberEmail = 'post-e2e-member@example.com';
  const authorEmail = 'post-e2e-author@example.com';
  const otherPw = 'secret123';

  function accessCookie(setCookie: unknown): string {
    const arr: string[] = Array.isArray(setCookie)
      ? (setCookie as string[])
      : [];
    return arr.find((c) => c.startsWith('access_token=')) ?? '';
  }

  // 지정 역할 사용자 생성 + 로그인하여 쿠키 반환
  async function makeUser(
    userEmail: string,
    role: 'MEMBER' | 'AUTHOR',
  ): Promise<{ id: string; cookie: string }> {
    const u = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await bcrypt.hash(otherPw, 10),
        name: role,
        role,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password: otherPw })
      .expect(200);
    return { id: u.id, cookie: accessCookie(login.headers['set-cookie']) };
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

    await prisma.user.deleteMany({
      where: { email: { in: [memberEmail, authorEmail] } },
    });
    const member = await makeUser(memberEmail, 'MEMBER');
    memberCookie = member.cookie;
    const author = await makeUser(authorEmail, 'AUTHOR');
    authorCookie = author.cookie;
    authorUserId = author.id;
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
      where: { email: { in: [email, memberEmail, authorEmail] } },
    });
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

  // 역할 기반 권한 (ADR-0018)
  it('MEMBER는 글 생성 불가 → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', memberCookie)
      .send(newPost)
      .expect(403);
  });

  it('AUTHOR는 본인 글 생성/수정 가능(201/200)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', authorCookie)
      .send(newPost)
      .expect(201);
    const id = (created.body as { id: string; authorId: string }).id;
    expect((created.body as { authorId: string }).authorId).toBe(authorUserId);

    await request(app.getHttpServer())
      .patch(`/api/posts/${id}`)
      .set('Cookie', authorCookie)
      .send({ title: '작성자 수정' })
      .expect(200);
  });

  it('AUTHOR가 타인(운영자) 글을 수정/삭제하면 403', async () => {
    // 운영자가 글 생성
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send(newPost)
      .expect(201);
    const id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/api/posts/${id}`)
      .set('Cookie', authorCookie)
      .send({ title: '침범' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/posts/${id}`)
      .set('Cookie', authorCookie)
      .expect(403);
  });

  it('ADMIN(운영자)은 작성자 글도 수정 가능(200)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', authorCookie)
      .send(newPost)
      .expect(201);
    const id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/api/posts/${id}`)
      .set('Cookie', cookie)
      .send({ title: '관리자 개입' })
      .expect(200);
  });

  // T-PUB-301: 본문 모델 전환(ADR-0021). contentHtml 입력 + 서버 sanitize.
  it('contentHtml 입력 시 응답에 contentHtml 포함 + sanitize 통과 결과로 저장', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({
        title: '리치 본문',
        contentHtml: '<h2>제목</h2><p><strong>굵게</strong></p>',
        tags: ['rich'],
      })
      .expect(201);
    const body = res.body as { id: string; contentHtml?: string };
    expect(body.contentHtml).toBeTruthy();
    expect(body.contentHtml).toMatch(/<h2>제목<\/h2>/);
    expect(body.contentHtml).toMatch(/<strong>굵게<\/strong>/);
  });

  it('<script>/onerror 등 위험 입력은 응답·DB 에서 제거된다 (서버 sanitize)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({
        title: '위험 본문',
        contentHtml:
          '<p>안녕</p><script>alert(1)</script><img src="x" onerror="alert(1)" />',
        tags: [],
      })
      .expect(201);
    const body = created.body as { id: string; contentHtml?: string };
    expect(body.contentHtml).not.toMatch(/<script/i);
    expect(body.contentHtml).not.toMatch(/onerror/i);
    expect(body.contentHtml).toContain('안녕');

    // 상세 GET 응답에도 동일
    await request(app.getHttpServer())
      .post(`/api/posts/${body.id}/publish`)
      .set('Cookie', cookie)
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/posts/${body.id}`)
      .expect(200);
    const detailBody = detail.body as { contentHtml?: string };
    expect(detailBody.contentHtml).not.toMatch(/<script/i);
    expect(detailBody.contentHtml).not.toMatch(/onerror/i);
  });

  it('contentMarkdown 만 보내도 호환된다 (서비스가 변환·sanitize 통과 후 저장)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({
        title: 'md only',
        contentMarkdown: '# 헤딩\n\n본문',
        tags: [],
      })
      .expect(201);
    const body = res.body as { id: string; contentHtml?: string };
    // contentHtml 가 자동으로 채워진다(서버가 마크다운 변환·sanitize)
    expect(body.contentHtml).toMatch(/<h1>헤딩<\/h1>/);
  });
});
