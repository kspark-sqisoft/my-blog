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

const uploadDir = path.join(os.tmpdir(), `blog-upload-e2e-${process.pid}`);
process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';
process.env.JWT_SECRET ??= 'test-secret';
process.env.UPLOAD_DIR = uploadDir;
process.env.UPLOAD_URL_BASE = '/uploads';
process.env.UPLOAD_MAX_BYTES = '1024'; // 이미지 한도(테스트용 작은 상한)
process.env.UPLOAD_MAX_BYTES_VIDEO = '2048'; // 비디오 한도(이미지보다 큼 — MIME 별 분리 검증)

describe('UploadController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;

  const email = 'upload-e2e@example.com';
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
    await seedOperator(prisma, { email, password });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    cookie = accessCookie(login.headers['set-cookie']);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('미인증 업로드는 401', () => {
    return request(app.getHttpServer())
      .post('/api/uploads')
      .attach('file', Buffer.from('x'), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(401);
  });

  it('이미지가 아닌 MIME은 400', () => {
    return request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('plain text'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('크기 상한 초과는 413', () => {
    const big = Buffer.alloc(2048, 1); // 2KB > 1KB 상한
    return request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
  });

  it('성공 시 201 + { url, contentType, size, type:"image" }', async () => {
    const buf = Buffer.from('small-image-bytes');
    const res = await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', buf, { filename: 'pic.png', contentType: 'image/png' })
      .expect(201);
    const body = res.body as {
      url: string;
      contentType: string;
      size: number;
      type: 'image' | 'video';
    };
    expect(body.url.startsWith('/uploads/')).toBe(true);
    expect(body.contentType).toBe('image/png');
    expect(body.size).toBe(buf.length);
    expect(body.type).toBe('image');
  });

  // T-PUB-202: MP4 수락 + MIME 별 분리 한도 + type:'video'
  it('MP4 업로드: 201 + contentType "video/mp4" + type:"video"', async () => {
    const buf = Buffer.from('small-mp4-bytes');
    const res = await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', buf, { filename: 'clip.mp4', contentType: 'video/mp4' })
      .expect(201);
    const body = res.body as {
      url: string;
      contentType: string;
      size: number;
      type: 'image' | 'video';
    };
    expect(body.url.endsWith('.mp4')).toBe(true);
    expect(body.contentType).toBe('video/mp4');
    expect(body.type).toBe('video');
  });

  it('MP4 비디오 한도(2KB) 초과는 413', () => {
    const tooBig = Buffer.alloc(3072, 1); // 3KB > 비디오 한도 2KB
    return request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', tooBig, {
        filename: 'big.mp4',
        contentType: 'video/mp4',
      })
      .expect(413);
  });

  it('이미지 한도(1KB)보다 큰 1.5KB MP4 는 허용된다 (MIME 별 분리 한도 회귀 가드)', () => {
    const mid = Buffer.alloc(1536, 1); // 1.5KB — 이미지 한도 초과, 비디오 한도 미만
    return request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', mid, { filename: 'mid.mp4', contentType: 'video/mp4' })
      .expect(201);
  });

  it('MOV/WebM 등 비허용 비디오 MIME 은 400', () => {
    return request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('mov-bytes'), {
        filename: 'a.mov',
        contentType: 'video/quicktime',
      })
      .expect(400);
  });

  it('MEMBER 권한은 403 (쓰기 권한 없음)', async () => {
    // 새 사용자 가입(기본 AUTHOR) → DB 직접 MEMBER 로 강등
    const memberEmail = 'upload-member-e2e@example.com';
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: memberEmail, password: 'secret123', name: 'M' })
      .expect(201);
    await prisma.user.update({
      where: { email: memberEmail },
      data: { role: 'MEMBER' },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: memberEmail, password: 'secret123' })
      .expect(200);
    const memberCookie = accessCookie(login.headers['set-cookie']);

    await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', memberCookie)
      .attach('file', Buffer.from('x'), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(403);

    await prisma.user.delete({ where: { email: memberEmail } });
  });

  it('업로드한 이미지는 반환된 URL로 다시 받을 수 있다(정적 서빙 200)', async () => {
    const buf = Buffer.from('static-serve-bytes');
    const up = await request(app.getHttpServer())
      .post('/api/uploads')
      .set('Cookie', cookie)
      .attach('file', buf, {
        filename: 'served.png',
        contentType: 'image/png',
      })
      .expect(201);
    const { url } = up.body as { url: string };

    const got = await request(app.getHttpServer()).get(url).expect(200);
    expect(got.headers['content-type']).toContain('image/png');
    expect(Buffer.from(got.body as Buffer)).toEqual(buf);
  });
});
