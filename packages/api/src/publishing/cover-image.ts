// 본문 마크다운에서 대표 이미지(첫 번째 이미지)의 URL을 추출한다.
// 글 목록의 커버 이미지로 사용된다. 마크다운 이미지와 원시 <img> 둘 다 인식하고,
// 텍스트 상 더 먼저 등장하는 이미지를 반환한다. 없으면 null.
const MD_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMAGE = /<img[^>]+src=["']([^"']+)["']/i;

export function extractFirstImageUrl(markdown: string): string | null {
  if (!markdown) return null;

  let bestUrl: string | null = null;
  let bestIdx = Number.POSITIVE_INFINITY;

  MD_IMAGE.lastIndex = 0;
  const md = MD_IMAGE.exec(markdown);
  if (md && md.index < bestIdx) {
    bestIdx = md.index;
    bestUrl = md[1];
  }

  const html = HTML_IMAGE.exec(markdown);
  if (html && html.index < bestIdx) {
    bestUrl = html[1];
  }

  return bestUrl;
}
