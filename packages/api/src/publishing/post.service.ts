import { Injectable, NotFoundException } from '@nestjs/common';
import type { PostDetailDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TagService } from './tag.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: TagService,
  ) {}

  async create(input: CreatePostInput): Promise<PostDetailDto> {
    const tagNames = input.tags ?? [];
    this.tags.assertWithinLimit(tagNames);
    const post = await this.prisma.post.create({
      data: {
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        authorId: input.authorId,
        postTags: this.tags.createInput(tagNames),
      },
      include: withTags,
    });
    return this.toDetail(post);
  }

  async update(id: string, input: UpdatePostInput): Promise<PostDetailDto> {
    await this.ensureExists(id);
    if (input.tags !== undefined) {
      this.tags.assertWithinLimit(input.tags);
    }
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.contentMarkdown !== undefined && {
          contentMarkdown: input.contentMarkdown,
        }),
        // tags가 주어지면 집합을 교체
        ...(input.tags !== undefined && {
          postTags: this.tags.replaceInput(input.tags),
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

  // 발행 (ADR-0005). 멱등: 이미 발행이면 publishedAt 유지.
  async publish(id: string): Promise<PostDetailDto> {
    const existing = await this.requirePost(id);
    if (existing.status === 'PUBLISHED') {
      return this.toDetail(existing);
    }
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: withTags,
    });
    return this.toDetail(post);
  }

  // 발행 취소. 멱등: 이미 초안이면 그대로. 초안은 publishedAt 없음으로 정리.
  async unpublish(id: string): Promise<PostDetailDto> {
    const existing = await this.requirePost(id);
    if (existing.status === 'DRAFT') {
      return this.toDetail(existing);
    }
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null },
      include: withTags,
    });
    return this.toDetail(post);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.post.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }
  }

  // 관계 포함 조회 + 존재 보장
  private async requirePost(id: string): Promise<PostWithTags> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: withTags,
    });
    if (!post) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }
    return post;
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
