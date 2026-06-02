import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface CreateCommentInput {
  body: string;
  displayName?: string;
  parentId?: string;
}

// Comment 작성. 성공 시 해당 Post 의 댓글 목록을 무효화해 갱신.
export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      api.post(`/posts/${postId}/comments`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}
