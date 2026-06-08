import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthorProfileDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

// 공개 작성자 프로필 조회 (ADR-0028). 이메일 등 민감 정보는 노출하지 않는다.
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // id(cuid)로 공개 프로필을 반환한다. 발행글 수(postCount)는 PUBLISHED만 센다.
  // 프로필 조회와 카운트를 단일 트랜잭션으로 묶어 왕복을 1회로 (N+1 없음).
  async getPublicProfile(id: string): Promise<AuthorProfileDto> {
    const [user, postCount] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id },
        // email 은 select 하지 않는다 — 공개 프로필에 노출 금지
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
        },
      }),
      this.prisma.post.count({
        where: { authorId: id, status: 'PUBLISHED' },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      postCount,
    };
  }
}
