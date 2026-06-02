import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
  let authorId: string;
  let cookie: string;

  const email = 'admin-list-e2e@example.com';
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
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email } });
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
    await posts.publish(pub.id);

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
});
