import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// Comment 수정(로그인 작성자 본인). 성공 시 해당 Post 의 댓글 목록을 무효화해 갱신.
export function useUpdateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch(`/posts/${postId}/comments/${id}`, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}
