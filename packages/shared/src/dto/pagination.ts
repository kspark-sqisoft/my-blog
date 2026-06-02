// 페이지네이션 응답 (ADR-0010: offset/page 기반)
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
