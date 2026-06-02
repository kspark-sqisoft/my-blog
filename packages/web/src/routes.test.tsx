import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('앱 라우터 + Query Provider (스모크)', () => {
  it('홈(/) 라우트가 렌더된다', async () => {
    renderAt('/');
    expect(await screen.findByTestId('page-home')).toBeInTheDocument();
  });

  it('로그인(/login) 라우트는 로그인 폼을 렌더한다', async () => {
    renderAt('/login');
    expect(
      await screen.findByRole('button', { name: '로그인' }),
    ).toBeInTheDocument();
  });

  it('TRD §5 라우트가 모두 등록되어 있다', () => {
    const paths = routes.map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/posts/:id',
        '/tags/:name',
        '/login',
        '/admin',
        '/admin/posts/new',
        '/admin/posts/:id/edit',
      ]),
    );
  });
});
