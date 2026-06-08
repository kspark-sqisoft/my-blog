import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// Comment 삭제(본인·운영자·글쓴이). 조건부 soft/hard 는 서버가 판정(ADR-0027).
// 성공 시 해당 Post 의 댓글 목록을 무효화해 갱신(soft 는 placeholder 로 재렌더).
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/posts/${postId}/comments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}
