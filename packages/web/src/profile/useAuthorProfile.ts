import type { AuthorProfileDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// 공개 작성자 프로필 조회 (GET /api/users/:id). 이메일 비노출 (ADR-0028).
// 없는 id → 404 → 에러 상태.
export function useAuthorProfile(userId: string) {
  return useQuery({
    queryKey: ['author', userId],
    enabled: userId.length > 0,
    queryFn: async () => {
      const res = await api.get<AuthorProfileDto>(
        `/users/${encodeURIComponent(userId)}`,
      );
      return res.data;
    },
  });
}
