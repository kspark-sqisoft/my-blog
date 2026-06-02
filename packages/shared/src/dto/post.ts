// 발행 상태 (ADR-0005). DB enum과 동일한 문자열 유니온.
export type PostStatus = 'DRAFT' | 'PUBLISHED';

// 목록 항목 (요약)
export interface PostSummaryDto {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string | null; // ISO 8601
}

// 상세
export interface PostDetailDto {
  id: string;
  title: string;
  contentMarkdown: string;
  tags: string[];
  status: PostStatus;
  authorId: string;
  publishedAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// 운영자 대시보드 목록 항목 (초안 포함, status 노출)
export interface AdminPostSummaryDto {
  id: string;
  title: string;
  status: PostStatus;
  tags: string[];
  publishedAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
}

// 생성 (운영자)
export interface CreatePostDto {
  title: string;
  contentMarkdown: string;
  tags: string[]; // 0~5개 (ADR-0006, 서버에서 강제)
}

// 수정 (부분)
export type UpdatePostDto = Partial<CreatePostDto>;
