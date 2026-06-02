import { QueryClient } from '@tanstack/react-query';

// 앱 전역 TanStack Query 클라이언트
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
