import type { PostDetailDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// 발행 Post 상세 조회 (GET /api/posts/:id). 초안/없음은 404 → 에러 상태.
export function usePost(id: string) {
  return useQuery({
    queryKey: ['post', id],
    enabled: id.length > 0,
    queryFn: async () => {
      const res = await api.get<PostDetailDto>(`/posts/${id}`);
      return res.data;
    },
  });
}
