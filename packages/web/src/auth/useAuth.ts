import type { AuthUserDto } from '@blog/shared';
import { create } from 'zustand';
import { api } from '../lib/api';

type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

interface AuthState {
  user: AuthUserDto | null;
  status: AuthStatus;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const INVALID_MSG = '이메일 또는 비밀번호가 올바르지 않습니다.';

// 운영자 인증 상태 (zustand). httpOnly 쿠키 기반이라 토큰은 보관하지 않는다(ADR-0001).
export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  async login(email, password) {
    set({ status: 'loading', error: null });
    try {
      const res = await api.post<{ user: AuthUserDto }>('/auth/login', {
        email,
        password,
      });
      set({ user: res.data.user, status: 'authenticated', error: null });
      return true;
    } catch {
      set({ user: null, status: 'unauthenticated', error: INVALID_MSG });
      return false;
    }
  },

  async fetchMe() {
    set({ status: 'loading' });
    try {
      const res = await api.get<{ user: AuthUserDto }>('/auth/me');
      set({ user: res.data.user, status: 'authenticated', error: null });
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // 무시: 어차피 클라이언트 상태는 초기화
    }
    set({ user: null, status: 'unauthenticated', error: null });
  },
}));
