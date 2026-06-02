import type {
  CreatePostDto,
  PostDetailDto,
  UpdatePostDto,
  UploadResultDto,
} from '@blog/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// 편집 화면 로드용 운영자 단건 조회 (초안 포함)
export function useAdminPost(id?: string) {
  return useQuery({
    queryKey: ['admin-post', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<PostDetailDto>(`/admin/posts/${id}`);
      return res.data;
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostDto) => api.post('/posts', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
  });
}

export function useUpdatePost(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePostDto) => api.patch(`/posts/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-post', id] });
    },
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<UploadResultDto>('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}
