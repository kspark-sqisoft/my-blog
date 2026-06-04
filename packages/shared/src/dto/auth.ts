// 사용자 역할 (ADR-0018). DB enum과 동일한 문자열 유니온.
export type UserRole = 'ADMIN' | 'AUTHOR' | 'MEMBER';

// 인증된 사용자 (민감 정보 제외).
// NOTE: name·role 필드는 T-AUTH-007(JwtStrategy DB 재조회 + 소비자 동시 수정)에서 추가한다.
export interface AuthUserDto {
  id: string;
  email: string;
}

// 회원가입 입력 (ADR-0018). 가입은 항상 MEMBER로 생성되며 클라이언트는 role을 지정하지 못한다.
export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}
