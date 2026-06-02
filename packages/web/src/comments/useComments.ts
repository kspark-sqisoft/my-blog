import type { CommentDto } from '@blog/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// 특정 Post 의 Comment 목록(깊이 2 중첩) 조회.
export function useComments(postId: string) {
  return useQuery({
    queryKey: ['comments', postId],
    enabled: postId.length > 0,
    queryFn: async () => {
      const res = await api.get<CommentDto[]>(`/posts/${postId}/comments`);
      return res.data;
    },
  });
}
