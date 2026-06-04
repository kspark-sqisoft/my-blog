import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdminUserDto, Paginated, UserRole } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
};

// 운영자 전용 사용자 관리 (ADR-0018)
@Injectable()
export class UserAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<AdminUserDto>> {
    const page = params.page ?? DEFAULT_PAGE;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const select = {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select,
      }),
      this.prisma.user.count(),
    ]);
    return { items: items.map((u) => this.toDto(u)), page, pageSize, total };
  }

  // 역할 변경. 마지막 ADMIN 강등은 차단(트랜잭션 내 count로 레이스 방지).
  async updateRole(id: string, role: UserRole): Promise<AdminUserDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }
      if (target.role === 'ADMIN' && role !== 'ADMIN') {
        const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          throw new ConflictException('마지막 관리자는 강등할 수 없습니다.');
        }
      }
      return tx.user.update({ where: { id }, data: { role } });
    });
    return this.toDto(updated);
  }

  private toDto(u: UserRow): AdminUserDto {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
