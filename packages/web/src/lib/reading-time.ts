// T-READ-101: 본문 HTML 에서 읽는 시간(분)을 추정한다(ADR-0023, 렌더타임 계산).
// 한글 기준 분당 ~500자. 순수 함수라 단위 테스트로 검증한다.

const CHARS_PER_MIN = 500;

// 글자 수에 영향을 주는 최소한의 HTML 엔티티만 디코드(공백/기본 기호).
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

// HTML 태그 제거 + 엔티티 디코드 후 평문을 만든다.
function stripHtml(html: string): string {
  const noTags = html.replace(/<[^>]*>/g, ' ');
  return noTags.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? ' ');
}

/**
 * 본문 HTML 의 읽는 시간을 분 단위로 추정한다.
 * - 공백을 제외한 글자 수를 500자/분으로 환산하고 올림한다.
 * - 본문이 비어 있으면 0 을 반환한다(호출부에서 표시를 숨긴다).
 * - 그 외에는 최소 1분을 보장한다.
 */
export function estimateReadingTime(html: string): number {
  const text = stripHtml(html ?? '');
  const chars = text.replace(/\s+/g, '').length; // 공백 제외 실제 글자 수
  if (chars === 0) return 0;
  return Math.max(1, Math.ceil(chars / CHARS_PER_MIN));
}
