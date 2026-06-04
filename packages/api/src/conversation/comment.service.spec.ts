import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { CommentService } from './comment.service';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('CommentService (통합)', () => {
  let moduleRef: TestingModule;
  let service: CommentService;
  let prisma: PrismaService;
  let authorId: string;
  let publishedId: string;
  let draftId: string;

  const authorEmail = 'comment-author@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [CommentService],
    }).compile();
    service = moduleRef.get(CommentService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();

    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
    const published = await prisma.post.create({
      data: {
        title: 'pub',
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    publishedId = published.id;
    const draft = await prisma.post.create({
      data: { title: 'draft', contentMarkdown: 'x', authorId },
    });
    draftId = draft.id;
  });

  beforeEach(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId } } });
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId } } });
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await moduleRef?.close();
  });

  it('최상위 Comment(depth 0)와 답글(depth 1)을 작성할 수 있다', async () => {
    const top = await service.create({ postId: publishedId, body: '최상위' });
    expect(top.parentId).toBeNull();
    expect(top.depth).toBe(0);

    const reply = await service.create({
      postId: publishedId,
      body: '답글',
      parentId: top.id,
    });
    expect(reply.parentId).toBe(top.id);
    expect(reply.depth).toBe(1);
  });

  it('로그인 회원 댓글은 userId 연결 + 계정 이름(실명), displayName 무시 (ADR-0018)', async () => {
    const user = await prisma.user.findUnique({ where: { id: authorId } });
    const c = await service.create({
      postId: publishedId,
      body: '회원 댓글',
      userId: authorId,
      displayName: '무시될-이름',
    });
    expect(c.userId).toBe(authorId);
    expect(c.authorName).toBe(user?.name);
    expect(c.displayName).toBeNull();
  });

  it('비로그인 댓글은 익명(displayName)이고 userId는 null (ADR-0018)', async () => {
    const c = await service.create({
      postId: publishedId,
      body: '익명 댓글',
      displayName: '익명이',
    });
    expect(c.userId).toBeNull();
    expect(c.authorName).toBe('익명이');
    expect(c.displayName).toBe('익명이');
  });

  it('깊이 2까지 허용하고 깊이 3은 BadRequestException', async () => {
    const top = await service.create({ postId: publishedId, body: 't' });
    const r1 = await service.create({
      postId: publishedId,
      body: 'r1',
      parentId: top.id,
    });
    const r2 = await service.create({
      postId: publishedId,
      body: 'r2',
      parentId: r1.id,
    });
    expect(r2.depth).toBe(2);

    await expect(
      service.create({ postId: publishedId, body: 'r3', parentId: r2.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('미발행 Post에는 작성할 수 없다(NotFound)', async () => {
    await expect(
      service.create({ postId: draftId, body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('없는 Post에는 작성할 수 없다(NotFound)', async () => {
    await expect(
      service.create({ postId: 'no-such', body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listByPost는 작성순으로 depth 0→1→2 중첩 구조를 반환한다', async () => {
    const top = await service.create({ postId: publishedId, body: 'top' });
    const r1 = await service.create({
      postId: publishedId,
      body: 'r1',
      parentId: top.id,
    });
    await service.create({ postId: publishedId, body: 'r2', parentId: r1.id });
    const top2 = await service.create({ postId: publishedId, body: 'top2' });

    const tree = await service.listByPost(publishedId);

    expect(tree.map((c) => c.id)).toEqual([top.id, top2.id]);
    expect(tree[0].depth).toBe(0);

    expect(tree[0].replies).toHaveLength(1);
    const reply1 = tree[0].replies[0];
    expect(reply1.body).toBe('r1');
    expect(reply1.depth).toBe(1);
    expect(reply1.replies).toHaveLength(1);
    const reply2 = reply1.replies[0];
    expect(reply2.body).toBe('r2');
    expect(reply2.depth).toBe(2);
    expect(reply2.replies).toEqual([]);

    expect(tree[1].id).toBe(top2.id);
    expect(tree[1].replies).toEqual([]);
  });

  it('listByPost는 댓글이 없으면 빈 배열을 반환한다', async () => {
    const tree = await service.listByPost(publishedId);
    expect(tree).toEqual([]);
  });
});
