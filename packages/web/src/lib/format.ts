// 날짜 포매팅 헬퍼 (한국어 표기)
export function fmtDate(iso: string | null): string {
  if (!iso) return '미발행';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '미발행';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
