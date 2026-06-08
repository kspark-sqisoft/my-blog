import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateSeriesDto,
  SeriesDetailDto,
  SeriesPostItemDto,
  UpdateSeriesDto,
} from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { extractFirstImageUrl } from './cover-image';
import { toSummaryText } from './markdown-summary';
import type { Actor } from './post.service';
import { slugify } from './slugify';

const SUMMARY_MAX = 200;

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
