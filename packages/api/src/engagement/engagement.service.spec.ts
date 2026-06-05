import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { EngagementService } from './engagement.service';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('EngagementService (통합)', () => {
  let moduleRef: TestingModule;
  let service: EngagementService;
  let prisma: PrismaService;
  let authorId: string;
  let publishedId: string;
  let draftId: string;

  const authorEmail = 'engagement-svc@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [EngagementService],
    }).compile();
    service = moduleRef.get(EngagementService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();

    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
    const published = await prisma.post.create({
      data: {
        slug: `eng-pub-${Date.now()}`,
        title: 'pub',
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    publishedId = published.id;
    const draft = await prisma.post.create({
      data: {
        slug: `eng-draft-${Date.now()}`,
        title: 'draft',
        contentMarkdown: 'x',
        authorId,
      },
    });
    draftId = draft.id;
  });

  beforeEach(async () => {
    await prisma.like.deleteMany({ where: { post: { authorId } } });
    await prisma.postView.deleteMany({ where: { post: { authorId } } });
    await prisma.post.updateMany({
      where: { authorId },
      data: { likeCount: 0, viewCount: 0 },
    });
  });

  afterAll(async () => {
    await prisma.like.deleteMany({ where: { post: { authorId } } });
    await prisma.postView.deleteMany({ where: { post: { authorId } } });
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await moduleRef?.close();
  });

  // ---- 좋아요 ----
  it('like: 좋아요를 누르면 likeCount 1, likedByMe true', async () => {
    const r = await service.like(publishedId, authorId);
    expect(r).toEqual({ likeCount: 1, likedByMe: true });
  });

  it('like: 멱등 — 같은 사용자가 두 번 눌러도 1', async () => {
    await service.like(publishedId, authorId);
    const r = await service.like(publishedId, authorId);
    expect(r).toEqual({ likeCount: 1, likedByMe: true });
    const count = await prisma.like.count({ where: { postId: publishedId } });
    expect(count).toBe(1);
  });

  it('unlike: 취소하면 likeCount 0, likedByMe false', async () => {
    await service.like(publishedId, authorId);
    const r = await service.unlike(publishedId, authorId);
    expect(r).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('unlike: 멱등 — 누른 적 없어도 0/false (감소 없음)', async () => {
    const r = await service.unlike(publishedId, authorId);
    expect(r).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('like: 미발행/없는 글은 NotFound', async () => {
    await expect(service.like(draftId, authorId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.like('no-such', authorId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ---- 조회수 ----
  it('recordView: 처음 조회하면 viewCount 1', async () => {
    const r = await service.recordView(publishedId, 'visitor-A');
    expect(r).toEqual({ viewCount: 1 });
  });

  it('recordView: 같은 방문자키는 30분 창 안에서 중복 집계되지 않는다', async () => {
    await service.recordView(publishedId, 'visitor-A');
    const r = await service.recordView(publishedId, 'visitor-A');
    expect(r).toEqual({ viewCount: 1 });
  });

  it('recordView: 다른 방문자키는 각각 집계된다', async () => {
    await service.recordView(publishedId, 'visitor-A');
    const r = await service.recordView(publishedId, 'visitor-B');
    expect(r).toEqual({ viewCount: 2 });
  });

  it('recordView: lastViewedAt 이 30분보다 과거면 다시 집계된다', async () => {
    await service.recordView(publishedId, 'visitor-A');
    // 31분 전으로 되돌림
    await prisma.postView.update({
      where: {
        postId_visitorKey: { postId: publishedId, visitorKey: 'visitor-A' },
      },
      data: { lastViewedAt: new Date(Date.now() - 31 * 60 * 1000) },
    });
    const r = await service.recordView(publishedId, 'visitor-A');
    expect(r).toEqual({ viewCount: 2 });
  });

  it('recordView: 미발행/없는 글은 NotFound', async () => {
    await expect(
      service.recordView(draftId, 'visitor-A'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.recordView('no-such', 'visitor-A'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
