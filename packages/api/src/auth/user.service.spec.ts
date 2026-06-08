import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';

// $transaction 배열 형태([findUnique, count])를 흉내내는 PrismaService 목.
function makePrisma(opts: {
  user?: Record<string, unknown> | null;
  postCount?: number;
}): { prisma: PrismaService; findUnique: jest.Mock; count: jest.Mock } {
  const findUnique = jest.fn().mockResolvedValue(opts.user ?? null);
  const count = jest.fn().mockResolvedValue(opts.postCount ?? 0);
  const prisma = {
    $transaction: jest.fn((arr: unknown[]) => Promise.all(arr)),
    user: { findUnique },
    post: { count },
  } as unknown as PrismaService;
  return { prisma, findUnique, count };
}

describe('UserService.getPublicProfile (T-AUTH-013, ADR-0028)', () => {
  it('AuthorProfileDto 로 매핑한다(이메일 비노출, postCount 포함)', async () => {
    const createdAt = new Date('2026-02-02T00:00:00Z');
    const { prisma, findUnique, count } = makePrisma({
      user: {
        id: 'u1',
        name: '글쓴이',
        avatarUrl: '/uploads/a.png',
        bio: '소개',
        createdAt,
      },
      postCount: 3,
    });
    const service = new UserService(prisma);

    const dto = await service.getPublicProfile('u1');

    expect(dto).toEqual({
      id: 'u1',
      name: '글쓴이',
      avatarUrl: '/uploads/a.png',
      bio: '소개',
      createdAt: createdAt.toISOString(),
      postCount: 3,
    });
    // 이메일은 절대 노출하지 않는다
    expect(dto).not.toHaveProperty('email');
    // select 에 email 미포함
    const [firstArg] = findUnique.mock.calls[0] as [
      { select: Record<string, unknown> },
    ];
    expect(firstArg.select.email).toBeUndefined();
    // postCount 는 PUBLISHED 만 카운트(N+1 없이 단일 count 쿼리)
    expect(count).toHaveBeenCalledWith({
      where: { authorId: 'u1', status: 'PUBLISHED' },
    });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('없는 id 면 NotFoundException', async () => {
    const { prisma } = makePrisma({ user: null, postCount: 0 });
    const service = new UserService(prisma);
    await expect(service.getPublicProfile('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('MEMBER(발행글 0)도 조회 가능, postCount 0', async () => {
    const createdAt = new Date('2026-03-03T00:00:00Z');
    const { prisma } = makePrisma({
      user: { id: 'm1', name: '회원', avatarUrl: null, bio: null, createdAt },
      postCount: 0,
    });
    const service = new UserService(prisma);

    const dto = await service.getPublicProfile('m1');

    expect(dto.postCount).toBe(0);
    expect(dto.avatarUrl).toBeNull();
    expect(dto.bio).toBeNull();
  });
});
