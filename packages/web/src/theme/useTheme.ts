import { create } from 'zustand';

// 라이트/다크 테마 토글. data-theme 속성으로 토큰을 전환하고 localStorage 에 보존한다.
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'blog-theme';

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // SSR/테스트 등 localStorage 접근 불가 시 기본값
  }
  return 'light';
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: readInitial(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // 무시: 저장 실패해도 화면 전환은 유지
    }
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
}));

// 모듈 로드시 초기 테마를 문서에 반영한다.
applyTheme(useTheme.getState().theme);
