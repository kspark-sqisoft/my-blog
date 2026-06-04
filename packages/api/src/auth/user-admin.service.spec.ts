import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { UserAdminService } from './user-admin.service';

// PrismaService 의 $transaction 시그니처를 흉내내는 헬퍼.
// interactive 모드: 첫 인자가 callback, 두 번째가 옵션({ isolationLevel })
type TxArgs = [callback: (tx: unknown) => unknown, options?: unknown];

interface MockTx {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
}

function makePrismaMock(tx: MockTx): {
  prisma: PrismaService;
  txCalls: TxArgs[];
} {
  const txCalls: TxArgs[] = [];
  const prisma = {
    $transaction: jest.fn((...args: TxArgs) => {
      txCalls.push(args);
      const [cb] = args;
      return Promise.resolve(cb(tx));
    }),
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  } as unknown as PrismaService;
  return { prisma, txCalls };
}

describe('UserAdminService.updateRole', () => {
  const targetAdmin = {
    id: 'admin1',
    email: 'a@x.com',
    name: 'A',
    role: 'ADMIN' as const,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('마지막 ADMIN 보호를 위해 Serializable 격리수준으로 트랜잭션을 연다 (H1)', async () => {
    const tx: MockTx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(targetAdmin),
        update: jest.fn().mockResolvedValue({ ...targetAdmin, role: 'AUTHOR' }),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const { prisma, txCalls } = makePrismaMock(tx);
    const service = new UserAdminService(prisma);

    await service.updateRole('admin1', 'AUTHOR');

    expect(txCalls).toHaveLength(1);
    const [, options] = txCalls[0];
    expect(options).toEqual(
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('대상이 없으면 NotFoundException', async () => {
    const tx: MockTx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    const { prisma } = makePrismaMock(tx);
    const service = new UserAdminService(prisma);
    await expect(
      service.updateRole('missing', 'AUTHOR'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ADMIN 이 1명뿐일 때 강등하면 ConflictException', async () => {
    const tx: MockTx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(targetAdmin),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const { prisma } = makePrismaMock(tx);
    const service = new UserAdminService(prisma);
    await expect(service.updateRole('admin1', 'AUTHOR')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN 이 둘 이상이면 강등 성공', async () => {
    const tx: MockTx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(targetAdmin),
        update: jest.fn().mockResolvedValue({ ...targetAdmin, role: 'AUTHOR' }),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const { prisma } = makePrismaMock(tx);
    const service = new UserAdminService(prisma);
    const result = await service.updateRole('admin1', 'AUTHOR');
    expect(result.role).toBe('AUTHOR');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'admin1' },
      data: { role: 'AUTHOR' },
    });
  });
});
