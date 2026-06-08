// XML/HTML 이스케이프 (ADR-0026). 피드·사이트맵·OG 메타에 들어가는
// 사용자 콘텐츠(제목·요약·작성자 등)의 주입을 막는다.
// & 를 가장 먼저 치환해 이중 이스케이프를 피한다.
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
