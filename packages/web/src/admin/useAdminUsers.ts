import type { AdminUserDto, Paginated, UserRole } from '@blog/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// 운영자 전용 사용자 목록 조회 — GET /api/admin/users (ADR-0018)
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get<Paginated<AdminUserDto>>('/admin/users', {
        params: { page: 1, pageSize: 50 },
      });
      return res.data;
    },
  });
}

// 역할 변경 — PATCH /api/admin/users/:id/role. 성공 시 목록 무효화.
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; role: UserRole }) =>
      api.patch(`/admin/users/${input.id}/role`, { role: input.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
