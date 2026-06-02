import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { CommentService } from './../src/conversation/comment.service';
import { seedOperator } from './../src/auth/seed-operator';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('CommentController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let comments: CommentService;
  let authorId: string;
  let postId: string;

  const authorEmail = 'comment-e2e@example.com';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    comments = moduleRef.get(CommentService);
    configureApp(app);
    await app.init();

    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
    const post = await prisma.post.create({
      data: {
        title: 'pub',
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    postId = post.id;
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId } } });
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await app.close();
  });

  it('GET /api/posts/:postId/comments (공개) → 중첩 구조 200', async () => {
    // throttle 영향 없이 직접 시드
    const top = await comments.create({ postId, body: '최상위' });
    await comments.create({ postId, body: '답글', parentId: top.id });

    const res = await request(app.getHttpServer())
      .get(`/api/posts/${postId}/comments`)
      .expect(200);
    const body = res.body as { id: string; replies: unknown[] }[];
    expect(body).toHaveLength(1);
    expect(body[0].replies).toHaveLength(1);
  });

  it('POST /api/posts/:postId/comments (공개, 익명) → 201 + CommentDto', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .send({ body: '익명 댓글', displayName: '방문자' })
      .expect(201);
    const body = res.body as { id: string; depth: number; body: string };
    expect(body.body).toBe('익명 댓글');
    expect(body.depth).toBe(0);
    expect(body.id).toBeTruthy();
  });

  it('body 누락 → 400', () => {
    return request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .send({ displayName: '방문자' })
      .expect(400);
  });

  it('body 길이 상한 초과 → 400', () => {
    return request(app.getHttpServer())
      .post(`/api/posts/${postId}/comments`)
      .send({ body: 'a'.repeat(1001) })
      .expect(400);
  });

  it('POST 레이트리밋 초과 시 429', async () => {
    let got429 = false;
    for (let i = 0; i < 30; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/posts/${postId}/comments`)
        .send({ body: `spam-${i}` });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }
    expect(got429).toBe(true);
  });
});
