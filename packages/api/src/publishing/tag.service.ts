import { BadRequestException, Injectable } from '@nestjs/common';
import type { TagDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

// Tag는 Publishing 내부 Value Object (ADR-0006). Post당 0~5개.
@Injectable()
export class TagService {
  static readonly MAX_TAGS = 5;

  constructor(private readonly prisma: PrismaService) {}

  // 발행된 Post에 쓰인 Tag 목록 + postCount (미사용/초안 전용 태그 제외)
  async listUsedTags(): Promise<TagDto[]> {
    const links = await this.prisma.postTag.findMany({
      where: { post: { status: 'PUBLISHED' } },
      select: { tag: { select: { name: true } } },
    });
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.tag.name, (counts.get(link.tag.name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, postCount]) => ({ name, postCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Post당 Tag 개수 제한 검증 (초과 시 BadRequest)
  assertWithinLimit(tags: string[]): void {
    if (tags.length > TagService.MAX_TAGS) {
      throw new BadRequestException(
        `Tag는 최대 ${TagService.MAX_TAGS}개까지 붙일 수 있습니다.`,
      );
    }
  }

  // Post.create 용 중첩 입력: 동일 name Tag는 connectOrCreate로 재사용
  createInput(tags: string[] = []) {
    return {
      create: tags.map((name) => ({
        tag: { connectOrCreate: { where: { name }, create: { name } } },
      })),
    };
  }

  // Post.update 용 중첩 입력: 기존 연결을 비우고 새 집합으로 교체
  replaceInput(tags: string[] = []) {
    return { deleteMany: {}, ...this.createInput(tags) };
  }
}
