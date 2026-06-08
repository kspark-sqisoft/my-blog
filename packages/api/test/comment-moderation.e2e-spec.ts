import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/common/app-setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { CommentService } from './../src/conversation/comment.service';
import { seedOperator } from './../src/auth/seed-operator';

// 절대규칙 #8: DATABASE_URL 은 jest-e2e.setup 이 blog_test 강제(여기서 설정 금지).
// 모더레이션은 comment.e2e 와 별도 spec 으로 분리한다 — 같은 spec 의 429 테스트가
// throttler(60s/10회)를 소진해 후속 요청을 막기 때문(독립 앱 = 독립 카운터).
describe('Comment 모더레이션 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let comments: CommentService;
  let authorId: string;
  let postId: string;
  let authorCookie = '';
  let otherCookie = '';

  const authorEmail = 'comment-mod-e2e@example.com';
  const otherEmail = 'comment-mod-other-e2e@example.com';

  async function loginCookie(email: string, password: string) {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const setCookie = login.headers['set-cookie'];
    const arr: string[] = Array.isArray(setCookie) ? setCookie : [];
    return arr.find((c) => c.startsWith('access_token=')) ?? '';
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    comments = moduleRef.get(CommentService);
    configureApp(app);
    await app.init();

    // author = 시드 운영자(ADMIN) 겸 글쓴이
    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
    const post = await prisma.post.create({
      data: {
        slug: `mod-${Date.now()}`,
        title: 'pub',
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    postId = post.id;

    // other = 무관한 일반 회원(MEMBER)
    await prisma.user.deleteMany({ where: { email: otherEmail } });
    await prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash: await bcrypt.hash('x', 10),
        name: 'other',
        role: 'MEMBER',
      },
    });

    authorCookie = await loginCookie(authorEmail, 'x');
    otherCookie = await loginCookie(otherEmail, 'x');
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId } } });
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({
      where: { email: { in: [authorEmail, otherEmail] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.comment.deleteMany({ where: { postId } });
  });

  const server = () => app.getHttpServer();

  it('PATCH 미인증 → 401', async () => {
    const c = await comments.create({ postId, body: 'x', userId: authorId });
    await request(server())
      .patch(`/api/posts/${postId}/comments/${c.id}`)
      .send({ body: 'y' })
      .expect(401);
  });

  it('본인 PATCH → 200 + body 변경 + isEdited', async () => {
    const c = await comments.create({ postId, body: '원본', userId: authorId });
    const res = await request(server())
      .patch(`/api/posts/${postId}/comments/${c.id}`)
      .set('Cookie', authorCookie)
      .send({ body: '수정됨' })
      .expect(200);
    const body = res.body as { body: string; isEdited: boolean };
    expect(body.body).toBe('수정됨');
    expect(body.isEdited).toBe(true);
  });

  it('타인 PATCH → 403', async () => {
    const c = await comments.create({ postId, body: 'x', userId: authorId });
    await request(server())
      .patch(`/api/posts/${postId}/comments/${c.id}`)
      .set('Cookie', otherCookie)
      .send({ body: 'y' })
      .expect(403);
  });

  it('없는 댓글 PATCH → 404', async () => {
    await request(server())
      .patch(`/api/posts/${postId}/comments/no-such`)
      .set('Cookie', authorCookie)
      .send({ body: 'y' })
      .expect(404);
  });

  it('DELETE 미인증 → 401', async () => {
    const c = await comments.create({ postId, body: 'x', userId: authorId });
    await request(server())
      .delete(`/api/posts/${postId}/comments/${c.id}`)
      .expect(401);
  });

  it('본인 DELETE 답글無 → 204 + 목록 소멸(hard)', async () => {
    const c = await comments.create({ postId, body: 'leaf', userId: authorId });
    await request(server())
      .delete(`/api/posts/${postId}/comments/${c.id}`)
      .set('Cookie', authorCookie)
      .expect(204);
    const list = await comments.listByPost(postId);
    expect(list.find((n) => n.id === c.id)).toBeUndefined();
  });

  // 절대규칙 #9: 쓰기(DELETE)→읽기(GET) 왕복으로 soft 가림+답글 보존 검증
  it('DELETE 답글有 → 204 + soft(isDeleted·body 가림·답글 보존)', async () => {
    const top = await comments.create({
      postId,
      body: 'top',
      userId: authorId,
    });
    await comments.create({
      postId,
      body: 'reply',
      parentId: top.id,
      userId: authorId,
    });
    await request(server())
      .delete(`/api/posts/${postId}/comments/${top.id}`)
      .set('Cookie', authorCookie)
      .expect(204);
    const res = await request(server())
      .get(`/api/posts/${postId}/comments`)
      .expect(200);
    const tree = res.body as {
      id: string;
      isDeleted: boolean;
      body: string;
      authorName: string | null;
      authorAvatarUrl: string | null;
      displayName: string | null;
      replies: unknown[];
    }[];
    const node = tree.find((n) => n.id === top.id);
    expect(node?.isDeleted).toBe(true);
    // 가림 4종(M6): body·authorName·authorAvatarUrl·displayName 모두 비노출
    expect(node?.body).toBe('');
    expect(node?.authorName).toBeNull();
    expect(node?.authorAvatarUrl).toBeNull();
    expect(node?.displayName).toBeNull();
    expect(node?.replies).toHaveLength(1);
  });

  it('soft 삭제 부모에 답글 POST → 400', async () => {
    const top = await comments.create({
      postId,
      body: 'top',
      userId: authorId,
    });
    await comments.create({
      postId,
      body: 'r',
      parentId: top.id,
      userId: authorId,
    });
    await request(server())
      .delete(`/api/posts/${postId}/comments/${top.id}`)
      .set('Cookie', authorCookie)
      .expect(204);
    await request(server())
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', authorCookie)
      .send({ body: '새 답글', parentId: top.id })
      .expect(400);
  });
});
