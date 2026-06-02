import type { AdminPostSummaryDto, Paginated } from '@blog/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// 운영자 전체 목록(초안+발행) 조회 — GET /api/admin/posts
export function useAdminPosts() {
  return useQuery({
    queryKey: ['admin-posts'],
    queryFn: async () => {
      const res = await api.get<Paginated<AdminPostSummaryDto>>(
        '/admin/posts',
        { params: { page: 1, pageSize: 50 } },
      );
      return res.data;
    },
  });
}

// 발행/발행취소/삭제 — 성공 시 목록 무효화
export function useAdminPostActions() {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
  };
  return {
    publish: useMutation({
      mutationFn: (id: string) => api.post(`/posts/${id}/publish`),
      onSuccess,
    }),
    unpublish: useMutation({
      mutationFn: (id: string) => api.post(`/posts/${id}/unpublish`),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/posts/${id}`),
      onSuccess,
    }),
  };
}
