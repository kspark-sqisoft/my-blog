import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateSeriesDto,
  Paginated,
  SeriesDetailDto,
  SeriesPostItemDto,
  SeriesSummaryDto,
  UpdateSeriesDto,
} from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { extractFirstImageUrl } from './cover-image';
import { toSummaryText } from './markdown-summary';
import type { Actor } from './post.service';
import { slugify } from './slugify';

const SUMMARY_MAX = 200;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

// 시리즈 상세 조회 시 발행글(순서대로) + 작성자 표시 이름을 함께 적재.
const detailInclude = {
  author: { select: { name: true } },
  posts: {
    where: { status: 'PUBLISHED' as const },
    orderBy: { seriesOrder: 'asc' as const },
    include: {
      postTags: { include: { tag: true } },
      author: { select: { name: true, avatarUrl: true } },
    },
  },
} as const;

// detailInclude 로 적재된 시리즈 행의 구조적 타입(생성 클라이언트 타입과 분리).
interface SeriesPostRow {
  id: string;
  slug: string;
  title: string;
  contentHtml: string;
  contentMarkdown: string;
  postTags: { tag: { name: string } }[];
  authorId: string;
  author: { name: string; avatarUrl: string | null };
  publishedAt: Date | null;
  viewCount: number;
  likeCount: number;
  seriesOrder: number;
}
interface SeriesRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  authorId: string;
  author: { name: string };
  posts: SeriesPostRow[];
}

// 시리즈 CRUD (Publishing, ADR-0029). 소유권은 Actor 패턴(ADR-0018) 재사용.
@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSeriesDto, actor: Actor): Promise<SeriesDetailDto> {
    const slug = await this.generateUniqueSlug(input.title);
    const series = await this.prisma.series.create({
      data: {
        slug,
        title: input.title,
        description: input.description ?? null,
        authorId: actor.id,
      },
      include: detailInclude,
    });
    return this.toDetail(series);
  }

  // 소유자/ADMIN 만. slug 는 불변(링크 안정성).
  async update(
    id: string,
    input: UpdateSeriesDto,
    actor: Actor,
  ): Promise<SeriesDetailDto> {
    await this.assertCanMutate(id, actor);
    const series = await this.prisma.series.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
      },
      include: detailInclude,
    });
    return this.toDetail(series);
  }

  // 소유자/ADMIN 만. 소속 글은 onDelete: SetNull 로 보존(연결만 해제).
  async remove(id: string, actor: Actor): Promise<void> {
    await this.assertCanMutate(id, actor);
    await this.prisma.series.delete({ where: { id } });
  }

  // 공개 시리즈 목록 (createdAt 최신순, offset 페이지네이션 — ADR-0010).
  // postCount 는 발행글 수(초안 제외). findMany+count+groupBy 로 N+1 없이 계산.
  async list(
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<SeriesSummaryDto>> {
    const page = params.page ?? DEFAULT_PAGE;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.series.findMany({
        // id 2차 정렬로 createdAt 동률에도 결정적 순서 → 페이지 경계 중복/누락 방지(ADR-0010)
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: { select: { name: true } } },
      }),
      this.prisma.series.count(),
    ]);

    // 이 페이지 시리즈들의 발행글 수를 한 번의 groupBy 로 집계(N+1 없음).
    const ids = rows.map((s) => s.id);
    const counts =
      ids.length === 0
        ? []
        : await this.prisma.post.groupBy({
            by: ['seriesId'],
            where: { seriesId: { in: ids }, status: 'PUBLISHED' },
            _count: { _all: true },
          });
    const countMap = new Map(counts.map((c) => [c.seriesId, c._count._all]));

    return {
      items: rows.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        description: s.description,
        authorId: s.authorId,
        authorName: s.author.name,
        postCount: countMap.get(s.id) ?? 0,
      })),
      page,
      pageSize,
      total,
    };
  }

  // 공개 시리즈 상세 (slug 우선, 없으면 cuid — ADR-0022). 발행글만 순서대로.
  async getDetail(idOrSlug: string): Promise<SeriesDetailDto> {
    const series = await this.prisma.series.findFirst({
      where: { OR: [{ slug: idOrSlug }, { id: idOrSlug }] },
      include: detailInclude,
    });
    if (!series) {
      throw new NotFoundException('시리즈를 찾을 수 없습니다.');
    }
    return this.toDetail(series);
  }

  // 멤버십·순서 원자 재지정 (ADR-0029). postIds 의 순서가 곧 seriesOrder.
  // 목록 글 → seriesId=this·seriesOrder=index, 목록에서 빠진 기존 소속 글 → seriesId=null.
  // 중복 postId 는 DTO(@ArrayUnique)가 거른다. 부분 적용 없음(단일 트랜잭션).
  async setPosts(
    id: string,
    postIds: string[],
    actor: Actor,
  ): Promise<SeriesDetailDto> {
    await this.assertCanMutate(id, actor);

    // 검증과 변경을 한 인터랙티브 트랜잭션 안에서 수행해 TOCTOU(검증 후 변경) 경합을
    // 차단한다 — 검증 통과 후 글 소유/존재가 바뀌어도 같은 트랜잭션이 원자적으로 처리한다.
    await this.prisma.$transaction(async (tx) => {
      if (postIds.length > 0) {
        const found = await tx.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, authorId: true },
        });
        // 존재하지 않는 글이 섞이면 400
        if (found.length !== postIds.length) {
          throw new BadRequestException(
            '존재하지 않는 글이 포함되어 있습니다.',
          );
        }
        // AUTHOR 는 본인 글만 편입 가능, ADMIN 은 임의 글 가능 (ADR-0029)
        if (actor.role !== 'ADMIN') {
          const hasOthers = found.some((p) => p.authorId !== actor.id);
          if (hasOthers) {
            throw new ForbiddenException(
              '본인 글만 시리즈에 넣을 수 있습니다.',
            );
          }
        }
      }

      // 목록에서 빠진 기존 소속 글 연결 해제
      await tx.post.updateMany({
        where: { seriesId: id, NOT: { id: { in: postIds } } },
        data: { seriesId: null },
      });
      // 목록 글을 순서대로 이 시리즈에 편입(다른 시리즈에 있었다면 이동)
      for (let index = 0; index < postIds.length; index += 1) {
        await tx.post.update({
          where: { id: postIds[index] },
          data: { seriesId: id, seriesOrder: index },
        });
      }
    });

    const series = await this.prisma.series.findUniqueOrThrow({
      where: { id },
      include: detailInclude,
    });
    return this.toDetail(series);
  }

  private async assertCanMutate(id: string, actor: Actor): Promise<void> {
    const series = await this.prisma.series.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!series) {
      throw new NotFoundException('시리즈를 찾을 수 없습니다.');
    }
    if (actor.role !== 'ADMIN' && series.authorId !== actor.id) {
      throw new ForbiddenException('본인 시리즈만 수정·삭제할 수 있습니다.');
    }
  }

  // 제목에서 유일한 슬러그 생성(ADR-0022 동형). 충돌이면 -2, -3 …
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let n = 1;
    while (
      await this.prisma.series.findUnique({
        where: { slug: candidate },
        select: { id: true },
      })
    ) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  private toDetail(series: SeriesRow): SeriesDetailDto {
    const posts: SeriesPostItemDto[] = series.posts.map((p) => {
      const body = p.contentHtml || p.contentMarkdown;
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: toSummaryText(body, SUMMARY_MAX),
        tags: p.postTags.map((pt) => pt.tag.name),
        authorId: p.authorId,
        authorName: p.author.name,
        authorAvatarUrl: p.author.avatarUrl ?? null,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        coverImageUrl: extractFirstImageUrl(body),
        viewCount: p.viewCount,
        likeCount: p.likeCount,
        seriesOrder: p.seriesOrder,
      };
    });
    return {
      id: series.id,
      slug: series.slug,
      title: series.title,
      description: series.description,
      authorId: series.authorId,
      authorName: series.author.name,
      postCount: posts.length,
      posts,
    };
  }
}
