import type { PostDetailDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// 발행 Post 상세 조회 (GET /api/posts/:idOrSlug). slug·cuid 둘 다 수용(ADR-0022).
// 한글 슬러그가 있을 수 있어 경로 세그먼트를 인코딩한다. 초안/없음은 404 → 에러 상태.
export function usePost(idOrSlug: string) {
  return useQuery({
    queryKey: ['post', idOrSlug],
    enabled: idOrSlug.length > 0,
    queryFn: async () => {
      const res = await api.get<PostDetailDto>(
        `/posts/${encodeURIComponent(idOrSlug)}`,
      );
      return res.data;
    },
  });
}
