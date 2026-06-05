import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { seedOperator } from './../src/auth/seed-operator';

const uploadDir = path.join(os.tmpdir(), `blog-avatar-e2e-${process.pid}`);
process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
process.env.UPLOAD_DIR = uploadDir;
process.env.UPLOAD_URL_BASE = '/uploads';
process.env.AVATAR_MAX_BYTES = '1024'; // 테스트용 작은 상한(2KB 버퍼로 413 검증)

describe('Profile / Avatar (e2e, ADR-0025)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;
  let postId: string;

  const email = 'profile-e2e@example.com';
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
    userId = user.id;
    const post = await prisma.post.create({
      data: {
        slug: `profile-e2e-${Date.now()}`,
        title: 'p',
        contentMarkdown: 'x',
        authorId: userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    postId = post.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    cookie = accessCookie(login.headers['set-cookie']);
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId: userId } } });
    await prisma.post.deleteMany({ where: { authorId: userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  // ---- 아바타 업로드 ----
  it('POST /api/profile/avatar 미인증 → 401', () => {
    return request(app.getHttpServer())
      .post('/api/profile/avatar')
      .attach('file', Buffer.from('x'), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(401);
  });

  it('이미지가 아닌 MIME → 400', () => {
    return request(app.getHttpServer())
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('plain'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('비디오(mp4)도 아바타로는 거부 → 400 (이미지 전용)', () => {
    return request(app.getHttpServer())
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('mp4'), {
        filename: 'a.mp4',
        contentType: 'video/mp4',
      })
      .expect(400);
  });

  it('크기 상한(1KB) 초과 → 413', () => {
    const big = Buffer.alloc(2048, 1);
    return request(app.getHttpServer())
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
  });

  it('성공 → 201 + { url } (로컬 /uploads 경로)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('avatar-bytes'), {
        filename: 'me.png',
        contentType: 'image/png',
      })
      .expect(201);
    const body = res.body as { url: string };
    expect(body.url.startsWith('/uploads/')).toBe(true);
  });

  // 절대규칙 #9: 반환 URL 이 실제 200 + 올바른 Content-Type 으로 서빙되는지 왕복 검증
  it('업로드한 아바타는 반환 URL로 다시 받을 수 있다(서빙 200 + image)', async () => {
    const buf = Buffer.from('served-avatar');
    const up = await request(app.getHttpServer())
      .post('/api/profile/avatar')
      .set('Cookie', cookie)
      .attach('file', buf, { filename: 'served.png', contentType: 'image/png' })
      .expect(201);
    const { url } = up.body as { url: string };
    const got = await request(app.getHttpServer()).get(url).expect(200);
    expect(got.headers['content-type']).toContain('image/png');
    expect(Buffer.from(got.body as Buffer)).toEqual(buf);
  });

  // ---- 프로필 수정 ----
  it('PATCH /api/auth/me 미인증 → 401', () => {
    return request(app.getHttpServer())
      .patch('/api/auth/me')
      .send({ name: '새이름' })
      .expect(401);
  });

  it('이름 변경 → 200 + user.name 갱신, GET /me 반영', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: '바뀐이름' })
      .expect(200);
    expect((res.body as { user: { name: string } }).user.name).toBe('바뀐이름');

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as { user: { name: string } }).user.name).toBe('바뀐이름');
  });

  it('아바타 경로 설정 → user.avatarUrl 반영', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl: '/uploads/my-avatar.png' })
      .expect(200);
    expect(
      (res.body as { user: { avatarUrl: string | null } }).user.avatarUrl,
    ).toBe('/uploads/my-avatar.png');
  });

  it('아바타 null → 제거', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl: null })
      .expect(200);
    expect(
      (res.body as { user: { avatarUrl: string | null } }).user.avatarUrl,
    ).toBeNull();
  });

  it('외부 URL avatarUrl 은 거부 → 400 (로컬 경로만 허용)', () => {
    return request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl: 'https://evil.example.com/x.png' })
      .expect(400);
  });

  it('이름 길이 초과(>50) → 400', () => {
    return request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: 'a'.repeat(51) })
      .expect(400);
  });

  // ---- 작성자 아바타 노출 (ADR-0025) ----
  it('아바타 설정 후 글 상세·댓글 응답에 authorAvatarUrl 노출', async () => {
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl: '/uploads/author.png' })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .expect(200);
    expect(
      (detail.body as { authorAvatarUrl: string | null }).authorAvatarUrl,
    ).toBe('/uploads/author.png');

    // 로그인 회원으로 댓글 작성 → authorAvatarUrl 포함
    const c = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', cookie)
      .send({ body: '아바타 댓글' })
      .expect(201);
    expect((c.body as { authorAvatarUrl: string | null }).authorAvatarUrl).toBe(
      '/uploads/author.png',
    );
  });
});
