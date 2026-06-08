import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { seedOperator } from './../src/auth/seed-operator';

// DATABASE_URL 은 jest-e2e.setup 이 blog_test 로 강제한다(절대규칙 #8 — 자체 기본값 미설정).
const uploadDir = path.join(os.tmpdir(), `blog-user-e2e-${process.pid}`);
process.env.JWT_SECRET ??= 'test-secret';
process.env.UPLOAD_DIR = uploadDir;
process.env.UPLOAD_URL_BASE = '/uploads';

describe('UserController GET /api/users/:id (e2e, T-AUTH-013, ADR-0028)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authorId: string;
  let memberId: string;
  let authorCookie: string;

  const authorEmail = 'user-e2e-author@example.com';
  const memberEmail = 'user-e2e-member@example.com';
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

    // 작성자(ADMIN) + 발행글 2 + 초안 1
    const author = await seedOperator(prisma, {
      email: authorEmail,
      password,
      name: '작성자',
    });
    authorId = author.id;
    const stamp = Date.now();
    await prisma.post.createMany({
      data: [
        {
          slug: `u-pub1-${stamp}`,
          title: 'p1',
          contentMarkdown: 'x',
          authorId,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        {
          slug: `u-pub2-${stamp}`,
          title: 'p2',
          contentMarkdown: 'x',
          authorId,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        {
          slug: `u-draft-${stamp}`,
          title: 'd1',
          contentMarkdown: 'x',
          authorId,
          status: 'DRAFT',
        },
      ],
    });

    // 발행글 0 인 MEMBER
    const member = await prisma.user.create({
      data: {
        email: memberEmail,
        passwordHash: await bcrypt.hash(password, 10),
        name: '회원',
        role: 'MEMBER',
      },
    });
    memberId = member.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: authorEmail, password })
      .expect(200);
    authorCookie = accessCookie(login.headers['set-cookie']);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({
      where: { email: { in: [authorEmail, memberEmail] } },
    });
    await app.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('없는 id → 404', () => {
    return request(app.getHttpServer())
      .get('/api/users/nonexistent-cuid')
      .expect(404);
  });

  it('작성자 프로필 → 200, postCount=발행글 수(초안 제외), 이메일 비노출', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/users/${authorId}`)
      .expect(200);
    const body = res.body as {
      id: string;
      name: string;
      createdAt: string;
      postCount: number;
      email?: string;
    };
    expect(body.id).toBe(authorId);
    expect(body.name).toBe('작성자');
    expect(body.postCount).toBe(2); // 발행 2건만(초안 제외)
    expect(typeof body.createdAt).toBe('string');
    // 이메일은 응답에 절대 포함되지 않는다
    expect(body.email).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(authorEmail);
  });

  it('발행글 0 인 MEMBER → 200, postCount 0', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/users/${memberId}`)
      .expect(200);
    const body = res.body as { postCount: number; email?: string };
    expect(body.postCount).toBe(0);
    expect(body.email).toBeUndefined();
  });

  // 절대규칙 #9: avatarUrl 이 있으면 그 /uploads 경로가 실제 200 + image 로 서빙되는지 왕복
  it('아바타 업로드 후 공개 프로필 avatarUrl 이 200 image 로 서빙된다', async () => {
    const buf = Buffer.from('avatar-served');
    const up = await request(app.getHttpServer())
      .post('/api/profile/avatar')
      .set('Cookie', authorCookie)
      .attach('file', buf, { filename: 'me.png', contentType: 'image/png' })
      .expect(201);
    const { url } = up.body as { url: string };
    // 업로드는 파일만 저장 + URL 반환 — 프로필 영속화는 PATCH /api/auth/me (ADR-0025)
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', authorCookie)
      .send({ avatarUrl: url })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/users/${authorId}`)
      .expect(200);
    const body = res.body as { avatarUrl: string | null };
    expect(body.avatarUrl).toBe(url);

    const got = await request(app.getHttpServer())
      .get(body.avatarUrl as string)
      .expect(200);
    expect(got.headers['content-type']).toContain('image/png');
    expect(Buffer.from(got.body as Buffer)).toEqual(buf);
  });
});
