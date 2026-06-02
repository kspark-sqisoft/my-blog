import type { Paginated, PostSummaryDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PostsQuery {
  page?: number;
  pageSize?: number;
  tag?: string;
}

// 발행 Post 목록 조회 (GET /api/posts). tag 지정 시 필터.
export function usePosts(params: PostsQuery) {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: async () => {
      const res = await api.get<Paginated<PostSummaryDto>>('/posts', {
        params,
      });
      return res.data;
    },
  });
}
