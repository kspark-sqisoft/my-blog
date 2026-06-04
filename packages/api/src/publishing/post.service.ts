import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminPostSummaryDto,
  Paginated,
  PostDetailDto,
  PostSummaryDto,
  UserRole,
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

// 글을 변경하려는 주체 (ADR-0018). ADMIN은 전체, AUTHOR는 본인 글만.
export interface Actor {
  id: string;
  role: UserRole;
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

  async update(
    id: string,
    input: UpdatePostInput,
    actor: Actor,
  ): Promise<PostDetailDto> {
    const existing = await this.requirePost(id);
    this.assertCanMutate(existing, actor);
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

  async remove(id: string, actor: Actor): Promise<void> {
    const existing = await this.requirePost(id);
    this.assertCanMutate(existing, actor);
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
    actor: Actor,
  ): Promise<Paginated<AdminPostSummaryDto>> {
    const page = params.page ?? DEFAULT_PAGE;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    // 작성자 스코프 (ADR-0019): ADMIN은 전체, AUTHOR는 본인 글만.
    const where = actor.role === 'ADMIN' ? {} : { authorId: actor.id };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: withTags,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items: items.map((p) => this.toAdminSummary(p)),
      page,
      pageSize,
      total,
    };
  }

  // 운영자/작성자 단건 상세 (초안 포함). 편집 화면 로드용.
  // ADR-0019: AUTHOR는 본인 글만 (없으면 404, 타인 글이면 403 — 순서 유지).
  async getForAdmin(id: string, actor: Actor): Promise<PostDetailDto> {
    const post = await this.requirePost(id);
    this.assertCanMutate(post, actor);
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
  async publish(id: string, actor: Actor): Promise<PostDetailDto> {
    const existing = await this.requirePost(id);
    this.assertCanMutate(existing, actor);
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
  async unpublish(id: string, actor: Actor): Promise<PostDetailDto> {
    const existing = await this.requirePost(id);
    this.assertCanMutate(existing, actor);
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

  // 소유권 검사 (ADR-0018): ADMIN은 전체, AUTHOR는 본인 글만. 위반 시 403.
  // (존재 여부는 호출 전 requirePost가 404로 먼저 처리한다 — 404 → 403 순서)
  private assertCanMutate(post: { authorId: string }, actor: Actor): void {
    if (actor.role === 'ADMIN') return;
    if (post.authorId === actor.id) return;
    throw new ForbiddenException('본인 글만 수정·삭제·발행할 수 있습니다.');
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
