import type { SeriesDetailDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// 공개 시리즈 상세 조회 (GET /api/series/:idOrSlug). 발행글만 순서대로 (ADR-0029).
// 한글 슬러그가 있을 수 있어 경로 세그먼트를 인코딩한다. 없는 시리즈는 404 → 에러 상태.
export function useSeries(idOrSlug: string) {
  return useQuery({
    queryKey: ['series', idOrSlug],
    enabled: idOrSlug.length > 0,
    queryFn: async () => {
      const res = await api.get<SeriesDetailDto>(
        `/series/${encodeURIComponent(idOrSlug)}`,
      );
      return res.data;
    },
  });
}
