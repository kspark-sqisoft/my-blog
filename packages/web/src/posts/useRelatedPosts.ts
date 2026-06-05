import type { RelatedPostDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// 관련 글 조회 (GET /api/posts/:idOrSlug/related). 태그 겹침 우선 → 최신 보완(서버).
// 한글 슬러그가 있을 수 있어 경로 세그먼트를 인코딩한다.
export function useRelatedPosts(idOrSlug: string, limit = 4) {
  return useQuery({
    queryKey: ['related', idOrSlug, limit],
    enabled: idOrSlug.length > 0,
    queryFn: async () => {
      const res = await api.get<RelatedPostDto[]>(
        `/posts/${encodeURIComponent(idOrSlug)}/related`,
        { params: { limit } },
      );
      return res.data;
    },
  });
}
