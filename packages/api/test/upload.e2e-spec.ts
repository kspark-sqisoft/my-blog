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
process.env.UPLOAD_MAX_BYTES = '1024'; // 테스트용 작은 상한

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

  it('성공 시 201 + { url, contentType, size }', async () => {
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
    };
    expect(body.url.startsWith('/uploads/')).toBe(true);
    expect(body.contentType).toBe('image/png');
    expect(body.size).toBe(buf.length);
  });
});
