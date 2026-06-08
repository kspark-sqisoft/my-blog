// 절대 URL 생성 유틸 (ADR-0026, seo-feed).
// 피드·사이트맵·OG 메타의 loc/og:url/og:image 는 모두 절대 URL 이어야 하므로
// SITE_URL 환경변수를 기준으로 상대 경로를 절대화한다. 하드코딩 금지.

// SITE_URL 미설정 시 dev 기본값. prod 는 반드시 환경변수로 주입한다.
const DEV_DEFAULT_SITE_URL = 'http://localhost:5173';

// 절대 URL(http/https) 판별용.
const ABSOLUTE_URL_RE = /^https?:\/\//i;

// 사이트 base URL. 후행 슬래시는 제거해 결합 시 중복을 피한다.
export function siteUrl(): string {
  return (process.env.SITE_URL ?? DEV_DEFAULT_SITE_URL).replace(/\/+$/, '');
}

// 외부 절대 URL 여부. og:image 폴백 판단에 쓴다(외부면 신뢰하지 않음).
export function isExternalUrl(url: string): boolean {
  return ABSOLUTE_URL_RE.test(url);
}

// 경로 세그먼트별 인코딩(한글 슬러그 등). 슬래시는 보존한다.
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

// 상대 경로를 base(기본 SITE_URL) 기준 절대 URL 로 변환한다.
// 이미 절대 URL 이면 그대로 반환한다.
// 계약: pathOrUrl 은 디코딩된 원본 경로여야 한다(예: '/posts/한글슬러그').
// 이미 %-인코딩된 경로를 넘기면 이중 인코딩되므로, DB 원본 slug 를 그대로 넘긴다.
export function absoluteUrl(
  pathOrUrl: string,
  base: string = siteUrl(),
): string {
  if (isExternalUrl(pathOrUrl)) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return base.replace(/\/+$/, '') + encodePath(path);
}
