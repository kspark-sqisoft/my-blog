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
  RelatedPostDto,
  UserRole,
} from '@blog/shared';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractFirstImageUrl } from './cover-image';
import { convertMarkdownToHtml, sanitizeRichHtml } from './markdown-to-html';
import { toSummaryText } from './markdown-summary';
import { slugify } from './slugify';
import { TagService } from './tag.service';

export interface ListPublishedParams {
  page?: number;
  pageSize?: number;
  tag?: string;
  q?: string;
  authorId?: string; // 작성자별 발행글 필터 (author-profile, ADR-0028)
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const SUMMARY_MAX = 200;

// ADR-0021 과도기: contentHtml 우선, 없으면 contentMarkdown 을 변환·sanitize.
// 둘 다 비어 있으면 BadRequest. T-WEB-303 이후 후속에서 contentMarkdown 입력 제거.
export interface CreatePostInput {
  title: string;
  contentMarkdown?: string;
  contentHtml?: string;
  authorId: string;
  tags?: string[];
}

export interface UpdatePostInput {
  title?: string;
  contentMarkdown?: string;
  contentHtml?: string;
  tags?: string[];
}

// 글을 변경하려는 주체 (ADR-0018). ADMIN은 전체, AUTHOR는 본인 글만.
export interface Actor {
  id: string;
  role: UserRole;
}

// 관계 포함 Post 조회 시 사용할 형태 (태그 + 작성자 표시 이름·아바타 — ADR-0017, ADR-0025)
const withTags = {
  postTags: { include: { tag: true } },
  author: { select: { name: true, avatarUrl: true } },
} as const;

type PostWithTags = {
  id: string;
  slug: string;
  title: string;
  contentMarkdown: string;
  contentHtml: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  authorId: string;
  viewCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  postTags: { tag: { name: string } }[];
  author: { name: string; avatarUrl: string | null };
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
    const { contentMarkdown, contentHtml } = this.resolveBody(input);
    const slug = await this.generateUniqueSlug(input.title);
    const post = await this.prisma.post.create({
      data: {
        slug,
        title: input.title,
        contentMarkdown,
        contentHtml,
        authorId: input.authorId,
        postTags: this.tags.createInput(tagNames),
      },
      include: withTags,
    });
    return this.toDetail(post);
  }

  // ADR-0021: contentHtml 우선 sanitize, 없으면 contentMarkdown 을 markdown-it → sanitize.
  // 양쪽 모두 비면 400. 본 메서드의 호출처는 create/update 만이며 update 는 부분 수정이므로
  // resolveBody 는 create 의 "필수" 의미로만 호출하고, update 는 별도로 처리한다.
  private resolveBody(input: {
    contentMarkdown?: string;
    contentHtml?: string;
  }): { contentMarkdown: string; contentHtml: string } {
    if (input.contentHtml && input.contentHtml.trim().length > 0) {
      return {
        contentMarkdown: input.contentMarkdown ?? '',
        contentHtml: sanitizeRichHtml(input.contentHtml),
      };
    }
    if (input.contentMarkdown && input.contentMarkdown.trim().length > 0) {
      return {
        contentMarkdown: input.contentMarkdown,
        contentHtml: convertMarkdownToHtml(input.contentMarkdown),
      };
    }
    throw new BadRequestException(
      'contentHtml 또는 contentMarkdown 중 하나는 필요합니다.',
    );
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
    // update: 부분 수정이라 body 가 함께 오면 둘 다 갱신, 한쪽만 오면 그쪽 기준으로 양쪽 동기.
    const bodyPatch =
      input.contentHtml !== undefined
        ? {
            contentMarkdown: input.contentMarkdown ?? existing.contentMarkdown,
            contentHtml: sanitizeRichHtml(input.contentHtml),
          }
        : input.contentMarkdown !== undefined
          ? {
              contentMarkdown: input.contentMarkdown,
              contentHtml: convertMarkdownToHtml(input.contentMarkdown),
            }
          : null;
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(bodyPatch && bodyPatch),
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
    // 키워드: 제목·본문(평문 contentMarkdown) 부분일치, 대소문자 무시. 공백뿐이면 무시.
    const q = params.q?.trim();
    const where = {
      status: 'PUBLISHED' as const,
      ...(params.authorId && { authorId: params.authorId }),
      ...(params.tag && {
        postTags: { some: { tag: { name: params.tag } } },
      }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { contentMarkdown: { contains: q, mode: 'insensitive' as const } },
        ],
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
  // 공개 상세 (ADR-0022): slug 우선, 없으면 cuid 로 발행글 조회. cuid 링크 호환.
  // viewerId: 로그인 사용자면 좋아요 여부(likedByMe)를 함께 계산한다(ADR-0024).
  async getPublishedDetail(
    idOrSlug: string,
    viewerId?: string,
  ): Promise<PostDetailDto> {
    const post = await this.prisma.post.findFirst({
      where: {
        status: 'PUBLISHED',
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      include: withTags,
    });
    if (!post) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }
    const likedByMe = viewerId
      ? !!(await this.prisma.like.findUnique({
          where: { postId_userId: { postId: post.id, userId: viewerId } },
          select: { postId: true },
        }))
      : false;
    return this.toDetail(post, likedByMe);
  }

  // 관련 글 (T-READ-104, ADR-0023): 공유 태그 수 desc → publishedAt desc, 자기 제외,
  // 부족분은 최신 발행글로 보완. 발행글만. 소스 글이 없거나 미발행이면 404.
  async getRelated(idOrSlug: string, limit = 4): Promise<RelatedPostDto[]> {
    const take = Math.max(1, Math.min(limit || 4, 20));
    const source = await this.prisma.post.findFirst({
      where: {
        status: 'PUBLISHED',
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
      },
      include: withTags,
    });
    if (!source) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }

    const sourceTags = source.postTags.map((pt) => pt.tag.name);
    const picked: PostWithTags[] = [];
    const seen = new Set<string>([source.id]);

    // 1) 태그 겹침 우선 (겹친 수 desc → publishedAt desc)
    if (sourceTags.length > 0) {
      const sharing = await this.prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          id: { not: source.id },
          postTags: { some: { tag: { name: { in: sourceTags } } } },
        },
        include: withTags,
      });
      sharing
        .map((p) => ({
          p,
          shared: p.postTags.filter((pt) => sourceTags.includes(pt.tag.name))
            .length,
        }))
        .sort(
          (a, b) =>
            b.shared - a.shared ||
            (b.p.publishedAt?.getTime() ?? 0) -
              (a.p.publishedAt?.getTime() ?? 0),
        )
        .forEach(({ p }) => {
          if (picked.length < take && !seen.has(p.id)) {
            picked.push(p);
            seen.add(p.id);
          }
        });
    }

    // 2) 부족분은 최신 발행글로 보완
    if (picked.length < take) {
      const recent = await this.prisma.post.findMany({
        where: { status: 'PUBLISHED', id: { notIn: [...seen] } },
        orderBy: { publishedAt: 'desc' },
        take: take - picked.length,
        include: withTags,
      });
      recent.forEach((p) => {
        picked.push(p);
        seen.add(p.id);
      });
    }

    return picked.map((p) => this.toRelated(p));
  }

  // 제목에서 유일한 슬러그 생성(ADR-0022). 충돌이면 -2, -3 … 부여.
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let n = 1;
    while (
      await this.prisma.post.findUnique({
        where: { slug: candidate },
        select: { id: true },
      })
    ) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
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

  // 본문 HTML(ADR-0021) 에서 요약(평문) + 대표 미디어(첫 img|video)를 생성.
  // contentHtml 가 비어있는 과도기 row 는 contentMarkdown 으로 폴백(T-INFRA-303 이후 거의 없음).
  private toSummary(post: PostWithTags): PostSummaryDto {
    const body = post.contentHtml || post.contentMarkdown;
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: toSummaryText(body, SUMMARY_MAX),
      tags: post.postTags.map((pt) => pt.tag.name),
      authorId: post.authorId,
      authorName: post.author.name,
      authorAvatarUrl: post.author.avatarUrl ?? null,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      coverImageUrl: extractFirstImageUrl(body),
      viewCount: post.viewCount,
      likeCount: post.likeCount,
    };
  }

  // 관련 글 카드용 매핑 (T-READ-104). 본문에서 대표 이미지 추출.
  private toRelated(post: PostWithTags): RelatedPostDto {
    const body = post.contentHtml || post.contentMarkdown;
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      tags: post.postTags.map((pt) => pt.tag.name),
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      coverImageUrl: extractFirstImageUrl(body),
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

  private toDetail(post: PostWithTags, likedByMe = false): PostDetailDto {
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      contentMarkdown: post.contentMarkdown,
      contentHtml: post.contentHtml,
      tags: post.postTags.map((pt) => pt.tag.name),
      status: post.status,
      authorId: post.authorId,
      authorName: post.author.name,
      authorAvatarUrl: post.author.avatarUrl ?? null,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      likedByMe,
      series: null, // 시리즈 네비게이션은 T-SER-005 에서 파생 (ADR-0029)
    };
  }
}
