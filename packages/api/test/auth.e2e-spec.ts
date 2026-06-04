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

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = 'login-e2e@example.com';
  const password = 'secret123';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    configureApp(app);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await seedOperator(prisma, { email, password });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  function getAccessCookie(setCookie: unknown): string {
    const arr: string[] = Array.isArray(setCookie)
      ? (setCookie as string[])
      : typeof setCookie === 'string'
        ? [setCookie]
        : [];
    return arr.find((c) => c.startsWith('access_token=')) ?? '';
  }

  it('POST /api/auth/login 성공 → 200, httpOnly+SameSite 쿠키 + user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookie = getAccessCookie(res.headers['set-cookie']);
    expect(cookie).toContain('access_token=');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect((res.body as { user: { email: string } }).user.email).toBe(email);
  });

  it('POST /api/auth/login 잘못된 비밀번호 → 401', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'wrong' })
      .expect(401);
  });

  it('GET /api/auth/me 유효 쿠키 → 200 user', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const cookie = getAccessCookie(login.headers['set-cookie']);

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    const me = (
      res.body as { user: { email: string; name: string; role: string } }
    ).user;
    expect(me.email).toBe(email);
    // JwtStrategy DB 재조회로 name·role 노출 (ADR-0018)
    expect(me.name.length).toBeGreaterThan(0);
    expect(me.role).toBe('ADMIN');
  });

  it('GET /api/auth/me 비로그인 → 401', () => {
    return request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('POST /api/auth/logout → 200, 쿠키 만료', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(200);
    const cookie = getAccessCookie(res.headers['set-cookie']);
    // 만료 쿠키: 빈 값 또는 Max-Age=0 / 과거 Expires
    expect(cookie).toMatch(
      /access_token=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i,
    );
  });
});
