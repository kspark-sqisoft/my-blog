// JWT 서명/검증 시크릿을 환경에서 강제 로드한다 (ADR-0001, C1).
// 폴백을 두지 않아야 운영 환경 누락 시 부팅을 차단할 수 있다 — 폴백이 있으면
// 공개된 기본값으로 토큰이 위조될 수 있다.
export function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.trim().length === 0) {
    throw new Error(
      'JWT_SECRET environment variable is required (not set or empty)',
    );
  }
  return value;
}
