// 발행 상태 (ADR-0005). DB enum과 동일한 문자열 유니온.
export type PostStatus = 'DRAFT' | 'PUBLISHED';

// 목록 항목 (요약)
export interface PostSummaryDto {
  id: string;
  slug: string; // URL 슬러그 (ADR-0022). canonical 링크는 /posts/{slug}
  title: string;
  summary: string;
  tags: string[];
  authorName: string; // 작성자 표시 이름 (ADR-0017)
  publishedAt: string | null; // ISO 8601
  coverImageUrl: string | null; // 본문 첫 이미지(대표 이미지) URL, 없으면 null
}

// 상세
// ADR-0021: 본문은 sanitize 된 HTML(`contentHtml`) 이 정규 모델로 전환된다.
// 과도기(T-INFRA-301 ~ T-PUB-301) 동안 contentHtml 은 optional 이고 contentMarkdown 도 남는다.
// T-PUB-301 이 contentHtml 을 required 로 회수하고 contentMarkdown 을 응답에서 제거한다.
export interface PostDetailDto {
  id: string;
  slug: string; // URL 슬러그 (ADR-0022)
  title: string;
  contentMarkdown: string; // @deprecated T-PUB-301 에서 응답·DB drop
  contentHtml?: string; // sanitize 통과한 본문 HTML (ADR-0021) — T-PUB-301 에서 required 전환
  tags: string[];
  status: PostStatus;
  authorId: string;
  authorName: string; // 작성자 표시 이름 (ADR-0017)
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

// 생성 (작성자/운영자).
// ADR-0021: 정규 입력은 contentHtml. 과도기에는 contentMarkdown 도 임시 허용 —
// T-PUB-301 이 contentHtml 을 required 로 회수하고 contentMarkdown 입력을 제거한다.
export interface CreatePostDto {
  title: string;
  contentMarkdown?: string; // @deprecated 과도기 입력. T-PUB-301 에서 제거
  contentHtml?: string; // T-PUB-301 에서 required 전환
  tags: string[]; // 0~5개 (ADR-0006, 서버에서 강제)
}

// 수정 (부분)
export type UpdatePostDto = Partial<CreatePostDto>;
