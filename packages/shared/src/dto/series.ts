// 시리즈(연재) 공유 타입 (ADR-0029). 순수 타입만 — zod 등 런타임 값 금지(함정 #9).
// 검증은 각 패키지(ADR-0004): 서버 class-validator, 웹 폼 인라인 zod.
import type { PostSummaryDto } from './post';

// 시리즈 목록 항목(요약). postCount 는 발행글 수(초안 제외).
export interface SeriesSummaryDto {
  id: string;
  slug: string; // URL 슬러그 (ADR-0022). /series/{slug}
  title: string;
  description: string | null;
  authorId: string; // 소유 작성자 (User.id). /users/:authorId 링크
  authorName: string;
  postCount: number; // 발행글 수
}

// 시리즈 상세: 요약 + 순서대로 정렬된 발행글 목록.
export interface SeriesDetailDto extends SeriesSummaryDto {
  posts: (PostSummaryDto & { seriesOrder: number })[];
}

// 글 상세의 시리즈 네비게이션용 이전/다음 글 최소 정보.
export interface SeriesNavPostDto {
  slug: string;
  title: string;
}

// 글 상세의 시리즈 네비게이션(현재 글이 시리즈 소속일 때).
export interface SeriesNavDto {
  id: string;
  slug: string;
  title: string;
  position: number; // 발행글 기준 1-based 현재 위치
  total: number; // 시리즈 발행글 총수
  prev: SeriesNavPostDto | null;
  next: SeriesNavPostDto | null;
}

// 입력 계약 (검증은 각 패키지)
export interface CreateSeriesDto {
  title: string;
  description?: string | null;
}
export type UpdateSeriesDto = Partial<CreateSeriesDto>;

// 멤버십·순서 원자 재지정: postIds 의 순서가 곧 seriesOrder.
export interface SetSeriesPostsDto {
  postIds: string[];
}
