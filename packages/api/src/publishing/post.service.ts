import { Injectable, NotFoundException } from '@nestjs/common';
import type { PostDetailDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePostInput {
  title: string;
  contentMarkdown: string;
  authorId: string;
  tags?: string[];
}

export interface UpdatePostInput {
  title?: string;
  contentMarkdown?: string;
  tags?: string[];
}

// 관계 포함 Post 조회 시 사용할 형태
const withTags = { postTags: { include: { tag: true } } } as const;

type PostWithTags = {
  id: string;
  title: string;
  contentMarkdown: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  postTags: { tag: { name: string } }[];
};

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePostInput): Promise<PostDetailDto> {
    const post = await this.prisma.post.create({
      data: {
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        authorId: input.authorId,
        postTags: this.tagCreate(input.tags),
      },
      include: withTags,
    });
    return this.toDetail(post);
  }

  async update(id: string, input: UpdatePostInput): Promise<PostDetailDto> {
    await this.ensureExists(id);
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.contentMarkdown !== undefined && {
          contentMarkdown: input.contentMarkdown,
        }),
        // tags가 주어지면 집합을 교체
        ...(input.tags !== undefined && {
          postTags: { deleteMany: {}, ...this.tagCreate(input.tags) },
        }),
      },
      include: withTags,
    });
    return this.toDetail(post);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.post.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.post.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }
  }

  // Tag를 connectOrCreate로 연결 (0~5 제한 검증은 TagService — T-PUB-003)
  private tagCreate(tags?: string[]) {
    const names = tags ?? [];
    return {
      create: names.map((name) => ({
        tag: { connectOrCreate: { where: { name }, create: { name } } },
      })),
    };
  }

  private toDetail(post: PostWithTags): PostDetailDto {
    return {
      id: post.id,
      title: post.title,
      contentMarkdown: post.contentMarkdown,
      tags: post.postTags.map((pt) => pt.tag.name),
      status: post.status,
      authorId: post.authorId,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
