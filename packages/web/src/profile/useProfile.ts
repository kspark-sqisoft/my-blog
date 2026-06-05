import type {
  AuthUserDto,
  AvatarUploadResultDto,
  UpdateProfileDto,
} from '@blog/shared';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';

// 아바타 업로드 (ADR-0025) → { url }. 영속화는 useUpdateProfile 이 PATCH 로 수행.
export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file: File): Promise<AvatarUploadResultDto> => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<AvatarUploadResultDto>('/profile/avatar', form);
      return res.data;
    },
  });
}

// 프로필(이름·아바타) 수정 (ADR-0025) → 인증 스토어의 user 갱신.
export function useUpdateProfile() {
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: UpdateProfileDto): Promise<AuthUserDto> => {
      const res = await api.patch<{ user: AuthUserDto }>('/auth/me', input);
      return res.data.user;
    },
    onSuccess: (user) => setUser(user),
  });
}
