import type { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Placeholder } from './components/Placeholder';
import { Login } from './pages/Login';

// TRD §5 라우트 (공개 + 운영자 보호). /admin 하위는 ProtectedRoute 로 감싼다.
export const routes: RouteObject[] = [
  { path: '/', element: <Placeholder name="home" /> },
  { path: '/posts/:id', element: <Placeholder name="post-detail" /> },
  { path: '/tags/:name', element: <Placeholder name="tag-posts" /> },
  { path: '/login', element: <Login /> },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <Placeholder name="admin" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/posts/new',
    element: (
      <ProtectedRoute>
        <Placeholder name="post-new" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin/posts/:id/edit',
    element: (
      <ProtectedRoute>
        <Placeholder name="post-edit" />
      </ProtectedRoute>
    ),
  },
];
