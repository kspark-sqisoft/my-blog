import type { Paginated, PostSummaryDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PostsQuery {
  page?: number;
  pageSize?: number;
  tag?: string;
  q?: string;
}

// 발행 Post 목록 조회 (GET /api/posts). tag 필터 / q 키워드 검색(제목·본문).
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
