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
});
