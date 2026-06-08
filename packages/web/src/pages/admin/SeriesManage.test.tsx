import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@blog/shared';

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { useAuth } from '../../auth/useAuth';
import { api } from '../../lib/api';
import { SeriesManage } from './SeriesManage';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const seriesItem = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 's-1',
  title: '내 연재',
  description: null,
  authorId: 'u1',
  authorName: '나',
  postCount: 0,
  ...over,
});

function setUser(role: UserRole, id = 'u1') {
  useAuth.setState({
    status: 'authenticated',
    user: {
      id,
      email: 'me@x.com',
      name: '나',
      role,
      avatarUrl: null,
      bio: null,
    },
    error: null,
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderManage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/series']}>
        <Routes>
          <Route
            path="/admin/series"
            element={
              <>
                <SeriesManage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/admin/series/:id/edit"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SeriesManage (/admin/series, T-WEB-504)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('AUTHOR', 'u1');
  });

  it('AUTHOR 는 본인 시리즈만 목록에 표시한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [
          seriesItem({ id: 's1', title: '내 연재', authorId: 'u1' }),
          seriesItem({ id: 's2', title: '남의 연재', authorId: 'other' }),
        ],
        page: 1,
        pageSize: 100,
        total: 2,
      },
    });
    renderManage();
    expect(await screen.findByText('내 연재')).toBeInTheDocument();
    expect(screen.queryByText('남의 연재')).not.toBeInTheDocument();
  });

  it('ADMIN 은 전체 시리즈를 표시한다', async () => {
    setUser('ADMIN', 'admin1');
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [
          seriesItem({ id: 's1', title: '내 연재', authorId: 'u1' }),
          seriesItem({ id: 's2', title: '남의 연재', authorId: 'other' }),
        ],
        page: 1,
        pageSize: 100,
        total: 2,
      },
    });
    renderManage();
    expect(await screen.findByText('내 연재')).toBeInTheDocument();
    expect(screen.getByText('남의 연재')).toBeInTheDocument();
  });

  it('새 시리즈 생성 → POST /series 후 편집 화면으로 이동', async () => {
    mockedApi.get.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 100, total: 0 },
    });
    mockedApi.post.mockResolvedValueOnce({ data: seriesItem({ id: 'new1' }) });
    renderManage();
    await screen.findByText('아직 시리즈가 없습니다.');

    fireEvent.change(screen.getByLabelText('새 시리즈 제목'), {
      target: { value: 'React 입문' },
    });
    fireEvent.click(screen.getByRole('button', { name: '시리즈 만들기' }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/series', {
        title: 'React 입문',
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe(
        '/admin/series/new1/edit',
      ),
    );
  });

  it('제목이 비면 검증 에러, POST 하지 않는다', async () => {
    mockedApi.get.mockResolvedValue({
      data: { items: [], page: 1, pageSize: 100, total: 0 },
    });
    renderManage();
    await screen.findByText('아직 시리즈가 없습니다.');
    fireEvent.click(screen.getByRole('button', { name: '시리즈 만들기' }));
    expect(await screen.findByText(/제목을 입력/)).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('삭제 버튼 → DELETE /series/:id', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        items: [seriesItem({ id: 's1', title: '내 연재', authorId: 'u1' })],
        page: 1,
        pageSize: 100,
        total: 1,
      },
    });
    mockedApi.delete.mockResolvedValueOnce({ data: {} });
    renderManage();
    await screen.findByText('내 연재');
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() =>
      expect(mockedApi.delete).toHaveBeenCalledWith('/series/s1'),
    );
  });
});
