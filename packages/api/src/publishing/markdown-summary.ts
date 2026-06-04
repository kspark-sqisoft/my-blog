// 본문 마크다운에서 목록용 요약 텍스트를 만든다.
// 이미지/코드/링크/헤딩/강조 등 마크다운 표기를 제거해 읽기 쉬운 평문으로 정리하고
// 길이를 제한한다. (목록 카드의 요약은 평문이어야 함)
export function toSummaryText(markdown: string, max = 200): string {
  if (!markdown) return '';
  let t = markdown;
  t = t.replace(/```[\s\S]*?```/g, ' '); // 코드펜스
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' '); // 이미지
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // 링크 → 텍스트
  t = t.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, ''); // 헤딩/인용/리스트 마커
  t = t.replace(/`([^`]*)`/g, '$1'); // 인라인 코드
  t = t.replace(/[*_~]{1,3}/g, ''); // 강조 기호
  t = t.replace(/\s+/g, ' ').trim(); // 공백 정리
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
