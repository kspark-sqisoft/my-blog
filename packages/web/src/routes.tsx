import type { RouteObject } from 'react-router-dom';
import { RoleRoute } from './auth/RoleRoute';
import { AdminLayout } from './components/layout/AdminLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { PostEditor } from './pages/admin/PostEditor';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UserManagement } from './pages/admin/UserManagement';
import { PostDetail } from './pages/PostDetail';
import { PostList } from './pages/PostList';
import { TagPosts } from './pages/TagPosts';

// TRD §5 라우트. 공개 화면은 PublicLayout(네비+푸터), 운영자 화면은
// ProtectedRoute + AdminLayout(사이드바) 아래에 중첩한다. 로그인은 단독 풀스크린.
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <PostList /> },
      { path: '/posts/:slug', element: <PostDetail /> },
      { path: '/tags/:name', element: <TagPosts /> },
    ],
  },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    element: (
      <RoleRoute roles={['AUTHOR', 'ADMIN']}>
        <AdminLayout />
      </RoleRoute>
    ),
    children: [
      { path: '/admin', element: <Dashboard /> },
      { path: '/admin/posts/new', element: <PostEditor /> },
      { path: '/admin/posts/:id/edit', element: <PostEditor /> },
      // 사용자 관리는 ADMIN 전용 — 운영자 셸 안에서 한 번 더 역할 게이팅
      {
        path: '/admin/users',
        element: (
          <RoleRoute roles={['ADMIN']}>
            <UserManagement />
          </RoleRoute>
        ),
      },
    ],
  },
];
