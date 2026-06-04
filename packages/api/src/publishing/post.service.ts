import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminPostSummaryDto,
  Paginated,
  PostDetailDto,
  PostSummaryDto,
} from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { extractFirstImageUrl } from './cover-image';
import { toSummaryText } from './markdown-summary';
import { TagService } from './tag.service';

export interface ListPublishedParams {
  page?: number;
  pageSize?: number;
  tag?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const SUMMARY_MAX = 200;

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

// 관계 포함 Post 조회 시 사용할 형태 (태그 + 작성자 표시 이름 — ADR-0017)
const withTags = {
  postTags: { include: { tag: true } },
  author: { select: { name: true } },
} as const;

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
  author: { name: string };
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

  // 발행된 Post 목록 (publishedAt 최신순, offset 페이지네이션 — ADR-0010).
  async listPublished(
    params: ListPublishedParams = {},
  ): Promise<Paginated<PostSummaryDto>> {
    const page = params.page ?? DEFAULT_PAGE;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = {
      status: 'PUBLISHED' as const,
      ...(params.tag && {
        postTags: { some: { tag: { name: params.tag } } },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: withTags,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((p) => this.toSummary(p)),
      page,
      pageSize,
      total,
    };
  }

  // 운영자 대시보드용 전체 목록 (초안+발행, createdAt 최신순, status 포함)
  async listForAdmin(
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<AdminPostSummaryDto>> {
    const page = params.page ?? DEFAULT_PAGE;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: withTags,
      }),
      this.prisma.post.count(),
    ]);

    return {
      items: items.map((p) => this.toAdminSummary(p)),
      page,
      pageSize,
      total,
    };
  }

  // 운영자 단건 상세 (초안 포함). 편집 화면 로드용.
  async getForAdmin(id: string): Promise<PostDetailDto> {
    const post = await this.requirePost(id);
    return this.toDetail(post);
  }

  // 발행된 Post 상세 (공개). 초안/없음은 NotFound로 숨긴다.
  async getPublishedDetail(id: string): Promise<PostDetailDto> {
    const post = await this.prisma.post.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: withTags,
    });
    if (!post) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }
    return this.toDetail(post);
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

  // 본문 마크다운에서 요약(평문) + 대표 이미지(첫 이미지)를 생성
  private toSummary(post: PostWithTags): PostSummaryDto {
    return {
      id: post.id,
      title: post.title,
      summary: toSummaryText(post.contentMarkdown, SUMMARY_MAX),
      tags: post.postTags.map((pt) => pt.tag.name),
      authorName: post.author.name,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      coverImageUrl: extractFirstImageUrl(post.contentMarkdown),
    };
  }

  private toAdminSummary(post: PostWithTags): AdminPostSummaryDto {
    return {
      id: post.id,
      title: post.title,
      status: post.status,
      tags: post.postTags.map((pt) => pt.tag.name),
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
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
      authorName: post.author.name,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
