import * as cheerio from 'cheerio';

// T-PUB-302: 본문 HTML(ADR-0021) 에서 목록 카드용 요약 평문을 추출한다.
// 이미지/비디오 노드는 텍스트가 없어 자연 제외, 링크는 표시 텍스트만 남는다.
// 공백 정리 + max 길이 trim. 함수명은 호환 유지(toSummaryText).
export function toSummaryText(html: string, max = 200): string {
  if (!html || !html.trim()) return '';
  const $ = cheerio.load(html, { xml: false });
  // 스타일·스크립트는 sanitize 단계에서 제거되지만 방어적으로 한 번 더.
  $('script, style').remove();
  const text = $.root().text();
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}
