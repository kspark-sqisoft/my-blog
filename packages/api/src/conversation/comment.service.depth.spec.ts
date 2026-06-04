import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { CommentService } from './comment.service';

// H2: 부모 체인을 따라 깊이를 계산하던 depthOf() (parent → 조부모 → ...)는
// 깊이 2 제한이라도 매 답글마다 최악 3쿼리(N+1)가 발생했다.
// → 부모 조회 시 parent.parent.parentId 까지 한 번에 select 해서
//   prisma.comment.findUnique 호출을 1회로 고정한다.

interface CommentMock {
  findUnique: jest.Mock;
  create: jest.Mock;
}

interface PostMock {
  findFirst: jest.Mock;
}

interface PrismaMock {
  post: PostMock;
  comment: CommentMock;
}

function makePrismaMock(parentRow: unknown): {
  prisma: PrismaService;
  prismaMock: PrismaMock;
} {
  const prismaMock: PrismaMock = {
    post: {
      findFirst: jest.fn().mockResolvedValue({ id: 'p1' }),
    },
    comment: {
      findUnique: jest.fn().mockResolvedValue(parentRow),
      create: jest.fn().mockImplementation(
        ({
          data,
        }: {
          data: {
            postId: string;
            body: string;
            parentId: string | null;
            userId: string | null;
            displayName: string | null;
          };
        }) =>
          Promise.resolve({
            id: 'child1',
            postId: data.postId,
            parentId: data.parentId,
            userId: data.userId,
            displayName: data.displayName,
            body: data.body,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            user: null,
          }),
      ),
    },
  };
  return { prisma: prismaMock as unknown as PrismaService, prismaMock };
}

describe('CommentService.create — depth 계산 (H2: N+1 제거)', () => {
  it('부모가 최상위(parentId=null)면 자식 depth=1, comment.findUnique 1회만 호출', async () => {
    const parentRow = {
      id: 'top',
      postId: 'p1',
      parentId: null,
      parent: null,
    };
    const { prisma, prismaMock } = makePrismaMock(parentRow);
    const service = new CommentService(prisma);

    const result = await service.create({
      postId: 'p1',
      body: 'r1',
      parentId: 'top',
    });

    expect(result.depth).toBe(1);
    expect(prismaMock.comment.findUnique).toHaveBeenCalledTimes(1);
  });

  it('부모가 1단 답글(parent.parentId=null)이면 자식 depth=2, findUnique 1회', async () => {
    const parentRow = {
      id: 'r1',
      postId: 'p1',
      parentId: 'top',
      parent: { parentId: null },
    };
    const { prisma, prismaMock } = makePrismaMock(parentRow);
    const service = new CommentService(prisma);

    const result = await service.create({
      postId: 'p1',
      body: 'r2',
      parentId: 'r1',
    });

    expect(result.depth).toBe(2);
    expect(prismaMock.comment.findUnique).toHaveBeenCalledTimes(1);
  });

  it('부모가 2단 답글(parent.parentId 존재, 조부모도 답글)이면 BadRequest + findUnique 1회', async () => {
    const parentRow = {
      id: 'r2',
      postId: 'p1',
      parentId: 'r1',
      parent: { parentId: 'top' },
    };
    const { prisma, prismaMock } = makePrismaMock(parentRow);
    const service = new CommentService(prisma);

    await expect(
      service.create({ postId: 'p1', body: 'r3', parentId: 'r2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.comment.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('부모가 다른 Post 의 댓글이면 NotFound', async () => {
    const parentRow = {
      id: 'top-other',
      postId: 'p2', // 다른 Post
      parentId: null,
      parent: null,
    };
    const { prisma } = makePrismaMock(parentRow);
    const service = new CommentService(prisma);

    await expect(
      service.create({ postId: 'p1', body: 'r', parentId: 'top-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('부모가 없으면 NotFound', async () => {
    const { prisma } = makePrismaMock(null);
    const service = new CommentService(prisma);

    await expect(
      service.create({ postId: 'p1', body: 'r', parentId: 'gone' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('부모 조회 select 에 parent.parentId 까지 포함된다 (회귀 가드)', async () => {
    const parentRow = {
      id: 'top',
      postId: 'p1',
      parentId: null,
      parent: null,
    };
    const { prisma, prismaMock } = makePrismaMock(parentRow);
    const service = new CommentService(prisma);

    await service.create({ postId: 'p1', body: 'r', parentId: 'top' });

    type FindUniqueArg = {
      select?: { parent?: { select?: { parentId?: boolean } } };
    };
    const calls = prismaMock.comment.findUnique.mock.calls as unknown as Array<
      [FindUniqueArg]
    >;
    const call = calls[0][0];
    expect(call.select?.parent?.select?.parentId).toBe(true);
  });
});
