import type { LikeStateDto, PostDetailDto, ViewCountDto } from '@blog/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// 좋아요 토글 (ADR-0024). 낙관적 업데이트 → 서버 응답으로 보정, 실패 시 롤백.
//   postId: 엔드포인트용 cuid. slug: 상세 쿼리 캐시 키(usePost 와 동일).
export function useToggleLike(postId: string, slug: string) {
  const qc = useQueryClient();
  const key = ['post', slug] as const;
  return useMutation({
    // 인자 liked = 현재(누른) 상태. 누른 상태면 취소(DELETE), 아니면 좋아요(POST).
    mutationFn: async (liked: boolean): Promise<LikeStateDto> => {
      const res = liked
        ? await api.delete<LikeStateDto>(`/posts/${postId}/like`)
        : await api.post<LikeStateDto>(`/posts/${postId}/like`);
      return res.data;
    },
    onMutate: async (liked) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PostDetailDto>(key);
      if (prev) {
        qc.setQueryData<PostDetailDto>(key, {
          ...prev,
          likedByMe: !liked,
          likeCount: prev.likeCount + (liked ? -1 : 1),
        });
      }
      return { prev };
    },
    onError: (_err, _liked, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (data) => {
      const prev = qc.getQueryData<PostDetailDto>(key);
      if (prev) qc.setQueryData<PostDetailDto>(key, { ...prev, ...data });
    },
  });
}

// 조회 기록 핑 (ADR-0024). 글을 연 시점에 1회 호출. 실패는 무시(지표일 뿐).
export function useRecordView() {
  return useMutation({
    mutationFn: (postId: string): Promise<ViewCountDto> =>
      api.post<ViewCountDto>(`/posts/${postId}/view`).then((r) => r.data),
  });
}
