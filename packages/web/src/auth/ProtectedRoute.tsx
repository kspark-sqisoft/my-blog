import { type ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

// 운영자 보호 라우트. 마운트 시 GET /api/auth/me 로 세션을 확인하고,
// 미인증이면 /login 으로 리다이렉트한다 (acceptance #2).
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const fetchMe = useAuth((s) => s.fetchMe);

  useEffect(() => {
    if (status === 'idle') {
      void fetchMe();
    }
  }, [status, fetchMe]);

  if (status === 'idle' || status === 'loading') {
    return <div className="p-8 text-center">확인 중…</div>;
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
