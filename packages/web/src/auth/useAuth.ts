import type { AuthUserDto } from '@blog/shared';
import { AxiosError } from 'axios';
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
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<boolean>;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const INVALID_MSG = '이메일 또는 비밀번호가 올바르지 않습니다.';
const EMAIL_TAKEN_MSG = '이미 사용 중인 이메일입니다.';
const REGISTER_FAIL_MSG = '회원가입에 실패했습니다. 잠시 후 다시 시도하세요.';

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

  async register(email, password, name) {
    set({ status: 'loading', error: null });
    try {
      const res = await api.post<{ user: AuthUserDto }>('/auth/register', {
        email,
        password,
        name,
      });
      set({ user: res.data.user, status: 'authenticated', error: null });
      return true;
    } catch (e) {
      // 409 면 이메일 중복, 그 외는 일반 실패 메시지로 구분한다.
      const status = e instanceof AxiosError ? e.response?.status : undefined;
      const error = status === 409 ? EMAIL_TAKEN_MSG : REGISTER_FAIL_MSG;
      set({ user: null, status: 'unauthenticated', error });
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
