// seo-feed 사이트 메타 상수 (ADR-0026). 피드 채널·OG 기본 메타에서 공유한다.
export const SITE_NAME = '디버그 노트';
export const SITE_DESCRIPTION =
  '개발하며 배운 것과 디버깅 기록을 남기는 블로그';

// 피드 항목 상한. FEED_MAX_ITEMS 환경변수(기본 20).
export function feedMaxItems(): number {
  const n = Number(process.env.FEED_MAX_ITEMS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}
