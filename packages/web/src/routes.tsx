import type { RouteObject } from 'react-router-dom';
import { Placeholder } from './components/Placeholder';

// TRD §5 라우트 (공개 + 운영자 보호). element는 후속 태스크에서 실제 페이지로 교체.
export const routes: RouteObject[] = [
  { path: '/', element: <Placeholder name="home" /> },
  { path: '/posts/:id', element: <Placeholder name="post-detail" /> },
  { path: '/tags/:name', element: <Placeholder name="tag-posts" /> },
  { path: '/login', element: <Placeholder name="login" /> },
  { path: '/admin', element: <Placeholder name="admin" /> },
  { path: '/admin/posts/new', element: <Placeholder name="post-new" /> },
  { path: '/admin/posts/:id/edit', element: <Placeholder name="post-edit" /> },
];
