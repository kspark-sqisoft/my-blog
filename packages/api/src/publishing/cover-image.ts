import * as cheerio from 'cheerio';

// T-PUB-302: 본문 HTML(ADR-0021) 에서 대표 미디어 URL 을 추출한다.
// 첫 <img> 또는 <video> 중 더 먼저 등장하는 src 를 반환. 둘 다 없으면 null.
// 함수명은 호환 유지(extractFirstImageUrl) — 의미는 첫 미디어(이미지 또는 비디오) URL 의 슈퍼셋.
export function extractFirstImageUrl(html: string): string | null {
  if (!html || !html.trim()) return null;
  const $ = cheerio.load(html, { xml: false });
  let firstSrc: string | null = null;
  $('img, video').each((_idx, el) => {
    const src = $(el).attr('src');
    if (src && src.trim().length > 0) {
      firstSrc = src;
      return false; // each 중단
    }
    return undefined;
  });
  return firstSrc;
}
