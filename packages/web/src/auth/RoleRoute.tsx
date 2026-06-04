import type { UserRole } from '@blog/shared';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './useAuth';

// 역할 기반 라우트 게이팅 (ADR-0018). 먼저 ProtectedRoute 로 인증을 보장하고,
// 인증된 사용자의 role 이 허용 목록에 없으면 홈('/')으로 리다이렉트한다 (acceptance #3).
export function RoleRoute({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  return (
    <ProtectedRoute>
      <RoleGate roles={roles}>{children}</RoleGate>
    </ProtectedRoute>
  );
}

// 내부 헬퍼: ProtectedRoute 가 인증을 보장한 뒤 role 만 검사한다(별도 export 안 함).
function RoleGate({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const user = useAuth((s) => s.user);
  if (user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
