import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { seedOperator } from './../src/auth/seed-operator';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog_test?schema=public';
process.env.JWT_SECRET ??= 'test-secret';

describe('AdminUsers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminId: string;
  let adminCookie: string;
  let memberId: string;
  let memberCookie: string;

  const adminEmail = 'admin-users-admin@example.com';
  const memberEmail = 'admin-users-member@example.com';
  const pw = 'secret123';

  function accessCookie(setCookie: unknown): string {
    const arr: string[] = Array.isArray(setCookie)
      ? (setCookie as string[])
      : [];
    return arr.find((c) => c.startsWith('access_token=')) ?? '';
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: pw })
      .expect(200);
    return accessCookie(res.headers['set-cookie']);
  }

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
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail] } },
    });
    const admin = await seedOperator(prisma, {
      email: adminEmail,
      password: pw,
    });
    adminId = admin.id;
    const member = await prisma.user.create({
      data: {
        email: memberEmail,
        passwordHash: await bcrypt.hash(pw, 10),
        name: '회원',
        role: 'MEMBER',
      },
    });
    memberId = member.id;
    adminCookie = await login(adminEmail);
    memberCookie = await login(memberEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, memberEmail] } },
    });
    await app.close();
  });

  it('GET /api/admin/users 미인증 → 401', () => {
    return request(app.getHttpServer()).get('/api/admin/users').expect(401);
  });

  it('GET /api/admin/users MEMBER → 403', () => {
    return request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', memberCookie)
      .expect(403);
  });

  it('GET /api/admin/users ADMIN → 200, role 포함 목록', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/users?page=1&pageSize=50')
      .set('Cookie', adminCookie)
      .expect(200);
    const body = res.body as {
      items: { id: string; email: string; role: string }[];
      total: number;
    };
    const mine = body.items.find((u) => u.id === memberId);
    expect(mine?.role).toBe('MEMBER');
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it('PATCH /api/admin/users/:id/role ADMIN → MEMBER를 AUTHOR로 승격(200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/users/${memberId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'AUTHOR' })
      .expect(200);
    expect((res.body as { role: string }).role).toBe('AUTHOR');
  });

  it('PATCH role 잘못된 값 → 400', () => {
    return request(app.getHttpServer())
      .patch(`/api/admin/users/${memberId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'SUPERVISOR' })
      .expect(400);
  });

  it('마지막 ADMIN 강등 → 409', async () => {
    // 다른 ADMIN이 남아있지 않도록 정리 → adminId만 유일한 ADMIN
    await prisma.user.updateMany({
      where: { role: 'ADMIN', NOT: { id: adminId } },
      data: { role: 'MEMBER' },
    });
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${adminId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'MEMBER' })
      .expect(409);
  });

  it('ADMIN이 2명이면 한 명 강등은 허용(200)', async () => {
    // memberId를 ADMIN으로 올려 2명 → adminId 강등 허용
    await prisma.user.update({
      where: { id: memberId },
      data: { role: 'ADMIN' },
    });
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${adminId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'MEMBER' })
      .expect(200);
  });
});
