import type {
  CreateSeriesDto,
  SeriesDetailDto,
  SetSeriesPostsDto,
  UpdateSeriesDto,
} from '@blog/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// 시리즈 관리 mutation 훅 (ADR-0029). 작성자/운영자 전용 화면에서 사용.
// 성공 시 공개 목록·상세 캐시를 무효화한다. 권한은 서버(Actor)가 강제.

export function useCreateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSeriesDto): Promise<SeriesDetailDto> => {
      const res = await api.post<SeriesDetailDto>('/series', input);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['series-list'] });
    },
  });
}

export function useUpdateSeries(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSeriesDto): Promise<SeriesDetailDto> => {
      const res = await api.patch<SeriesDetailDto>(`/series/${id}`, input);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['series-list'] });
      void queryClient.invalidateQueries({ queryKey: ['series', id] });
    },
  });
}

export function useDeleteSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/series/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['series-list'] });
    },
  });
}

// 멤버십·순서 원자 재지정 (PUT /series/:id/posts). postIds 순서 = seriesOrder.
export function useSetSeriesPosts(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetSeriesPostsDto): Promise<SeriesDetailDto> => {
      const res = await api.put<SeriesDetailDto>(`/series/${id}/posts`, input);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['series', id] });
      void queryClient.invalidateQueries({ queryKey: ['series-list'] });
    },
  });
}
