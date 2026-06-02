import type { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Placeholder } from './components/Placeholder';
import { Dashboard } from './pages/admin/Dashboard';
import { Login } from './pages/Login';
import { PostDetail } from './pages/PostDetail';
import { PostList } from './pages/PostList';
import { TagPosts } from './pages/TagPosts';

// TRD §5 라우트 (공개 + 운영자 보호). /admin 하위는 ProtectedRoute 로 감싼다.
export const routes: RouteObject[] = [
  { path: '/', element: <PostList /> },
  { path: '/posts/:id', element: <PostDetail /> },
  { path: '/tags/:name', element: <TagPosts /> },
  { path: '/login', element: <Login /> },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <Dashboard />
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
