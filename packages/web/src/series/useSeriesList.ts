import type { Paginated, SeriesSummaryDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface SeriesListQuery {
  page?: number;
  pageSize?: number;
}

// 공개 시리즈 목록 조회 (GET /api/series). 페이지네이션 (ADR-0010, ADR-0029).
export function useSeriesList(params: SeriesListQuery) {
  return useQuery({
    queryKey: ['series-list', params],
    queryFn: async () => {
      const res = await api.get<Paginated<SeriesSummaryDto>>('/series', {
        params,
      });
      return res.data;
    },
  });
}
