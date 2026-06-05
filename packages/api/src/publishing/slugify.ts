// 제목 → URL 슬러그 (ADR-0022). 한글은 보존하고, 영문은 소문자화, 공백→-,
// 한글·영숫자·하이픈 외 문자는 제거한다. 빈 결과는 'post' 로 폴백, 최대 80자.
const MAX_LEN = 80;

// 허용: 한글(완성형 가-힣 + 자모 ㄱ-ㅎ, ㅏ-ㅣ), 영문/숫자, 공백, 하이픈
const DISALLOWED = /[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9\s-]/g;

export function slugify(title: string): string {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(DISALLOWED, '') // 허용 외 제거
    .trim()
    .replace(/[\s-]+/g, '-') // 연속 공백/하이픈 → 하나의 하이픈
    .replace(/^-+|-+$/g, '') // 양끝 하이픈 제거
    .slice(0, MAX_LEN)
    .replace(/-+$/, ''); // 자르며 생긴 끝 하이픈 정리

  return slug || 'post';
}
