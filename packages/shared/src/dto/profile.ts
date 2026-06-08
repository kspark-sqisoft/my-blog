// 프로필 수정 입력 계약 (ADR-0025). 이름 + 아바타만.
// 검증은 각 패키지(ADR-0004): 웹은 zod(폼), api 는 class-validator. shared 는 순수 타입만 둔다
// (zod 등 런타임 의존을 shared 에 넣으면 prod api 가 @blog/shared 로딩 시 그 의존을 강제 require 한다).
export interface UpdateProfileDto {
  name?: string; // 1~50자 (각 패키지가 검증)
  avatarUrl?: string | null; // 로컬 /uploads 경로 또는 null(제거). 외부 URL 거부
  bio?: string | null; // 소개 0~200자 또는 null(제거) — ADR-0028 (ADR-0025 amend)
}

// 아바타 업로드 응답 (ADR-0025).
export interface AvatarUploadResultDto {
  url: string; // 로컬 /uploads 경로
}
