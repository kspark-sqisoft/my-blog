// 사용자 역할 (ADR-0018). DB enum과 동일한 문자열 유니온.
export type UserRole = 'ADMIN' | 'AUTHOR' | 'MEMBER';

// 인증된 사용자 (민감 정보 제외). name·role 포함 — 작성자 표시·권한 분기의 단일 출처 (ADR-0018).
export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null; // 아바타 이미지 URL (ADR-0025). 로컬 /uploads 경로 또는 null
}

// 회원가입 입력 (ADR-0018). 가입은 항상 MEMBER로 생성되며 클라이언트는 role을 지정하지 못한다.
export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}
