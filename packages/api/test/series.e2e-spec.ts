import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';

// DATABASE_URL 은 jest-e2e.setup 이 blog_test 로 강제(절대규칙 #8 — 자체 기본값 미설정).
describe('SeriesController CRUD (e2e, T-SER-002, ADR-0029)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;
  let strangerId: string;
  let ownerCookie: string; // AUTHOR(소유자)
  let strangerCookie: string; // AUTHOR(타인)

  const ownerEmail = 'series-e2e-owner@example.com';
  const strangerEmail = 'series-e2e-stranger@example.com';
  const password = 'secret123';

  function accessCookie(setCookie: unknown): string {
    const arr: string[] = Array.isArray(setCookie)
      ? (setCookie as string[])
      : [];
    return arr.find((c) => c.startsWith('access_token=')) ?? '';
  }

  async function makeAuthor(email: string): Promise<{ id: string }> {
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name: email.split('@')[0],
        role: 'AUTHOR',
      },
    });
    return { id: u.id };
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
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

    const owner = await makeAuthor(ownerEmail);
    ownerId = owner.id;
    const stranger = await makeAuthor(strangerEmail);
    strangerId = stranger.id;
    ownerCookie = await login(ownerEmail);
    strangerCookie = await login(strangerEmail);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({
      where: { authorId: { in: [ownerId, strangerId] } },
    });
    await prisma.series.deleteMany({
      where: { authorId: { in: [ownerId, strangerId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, strangerEmail] } },
    });
    await app.close();
  });

  it('미인증 쓰기는 401 (POST/PATCH/DELETE)', async () => {
    await request(app.getHttpServer())
      .post('/api/series')
      .send({ title: 'x' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/series/x')
      .send({ title: 'y' })
      .expect(401);
    await request(app.getHttpServer()).delete('/api/series/x').expect(401);
  });

  it('POST /api/series → 201, authorId·slug·posts[] 반환', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: 'React 연재', description: '초보용' })
      .expect(201);
    const body = res.body as {
      id: string;
      slug: string;
      authorId: string;
      description: string | null;
      posts: unknown[];
      postCount: number;
    };
    expect(body.id).toBeTruthy();
    expect(body.authorId).toBe(ownerId);
    expect(body.slug).toBe('react-연재');
    expect(body.description).toBe('초보용');
    expect(body.posts).toEqual([]);
    expect(body.postCount).toBe(0);
  });

  it('POST title 누락/초과 → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: 'a'.repeat(121) })
      .expect(400);
  });

  it('PATCH /api/series/:id 소유자 200(slug 불변), 타인 403, 없음 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: '수정 대상' })
      .expect(201);
    const { id, slug } = created.body as { id: string; slug: string };

    const updated = await request(app.getHttpServer())
      .patch(`/api/series/${id}`)
      .set('Cookie', ownerCookie)
      .send({ title: '수정됨' })
      .expect(200);
    expect((updated.body as { title: string; slug: string }).title).toBe(
      '수정됨',
    );
    expect((updated.body as { slug: string }).slug).toBe(slug); // 불변

    await request(app.getHttpServer())
      .patch(`/api/series/${id}`)
      .set('Cookie', strangerCookie)
      .send({ title: '침범' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/series/nonexistent')
      .set('Cookie', ownerCookie)
      .send({ title: 'x' })
      .expect(404);
  });

  it('DELETE /api/series/:id 소유자 204 + 소속 글 보존(seriesId=null), 타인 403', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: '삭제 대상' })
      .expect(201);
    const { id } = created.body as { id: string };
    const post = await prisma.post.create({
      data: {
        slug: `se2-${Date.now()}`,
        title: '소속 글',
        contentMarkdown: 'x',
        authorId: ownerId,
        seriesId: id,
        seriesOrder: 0,
      },
    });

    // 타인 삭제 시도 → 403
    await request(app.getHttpServer())
      .delete(`/api/series/${id}`)
      .set('Cookie', strangerCookie)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/series/${id}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    const after = await prisma.post.findUnique({ where: { id: post.id } });
    expect(after).not.toBeNull();
    expect(after?.seriesId).toBeNull();
  });

  // T-SER-003: PUT /api/series/:id/posts 멤버십·순서 재지정
  async function publish(authorId: string, title: string): Promise<string> {
    const p = await prisma.post.create({
      data: {
        slug: `pe-${title}-${Date.now()}`,
        title,
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    return p.id;
  }

  it('PUT posts: 순서대로 재지정하고 상세 posts 순서로 반영(소유자)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: '재지정 연재' })
      .expect(201);
    const { id } = created.body as { id: string };
    const a = await publish(ownerId, 'A');
    const b = await publish(ownerId, 'B');

    const res = await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .set('Cookie', ownerCookie)
      .send({ postIds: [b, a] })
      .expect(200);
    const body = res.body as { posts: { id: string }[]; postCount: number };
    expect(body.posts.map((p) => p.id)).toEqual([b, a]);
    expect(body.postCount).toBe(2);
  });

  it('PUT posts: AUTHOR 타인 글 포함 403, ADMIN 은 임의 글 가능', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: '교차소유 연재' })
      .expect(201);
    const { id } = created.body as { id: string };
    const theirs = await publish(strangerId, 'THEIRS');

    // owner(AUTHOR) 가 타인 글 편입 → 403
    await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .set('Cookie', ownerCookie)
      .send({ postIds: [theirs] })
      .expect(403);

    // 운영자로 승격 후 ADMIN 은 가능 — strangerId 를 ADMIN 으로
    await prisma.user.update({
      where: { id: strangerId },
      data: { role: 'ADMIN' },
    });
    const adminCookie = await login(strangerEmail);
    await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .set('Cookie', adminCookie)
      .send({ postIds: [theirs] })
      .expect(200);
    // 원복
    await prisma.user.update({
      where: { id: strangerId },
      data: { role: 'AUTHOR' },
    });
  });

  it('PUT posts: 없는 글 400, 중복 postId 400, 미인증 401', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/series')
      .set('Cookie', ownerCookie)
      .send({ title: '검증 연재' })
      .expect(201);
    const { id } = created.body as { id: string };
    const a = await publish(ownerId, 'V');

    await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .send({ postIds: [a] })
      .expect(401);
    await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .set('Cookie', ownerCookie)
      .send({ postIds: ['no-such'] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .set('Cookie', ownerCookie)
      .send({ postIds: [a, a] })
      .expect(400);
    // postIds 100건 초과 → 400 (@ArrayMaxSize(100))
    await request(app.getHttpServer())
      .put(`/api/series/${id}/posts`)
      .set('Cookie', ownerCookie)
      .send({ postIds: Array.from({ length: 101 }, (_, i) => `p${i}`) })
      .expect(400);
  });
});
