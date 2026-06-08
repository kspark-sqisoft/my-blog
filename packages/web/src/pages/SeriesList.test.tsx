import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }));

import { api } from '../lib/api';
import { SeriesList } from './SeriesList';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const summary = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 'react-입문',
  title: 'React 입문',
  description: '초보용 연재',
  authorId: 'u1',
  authorName: '글쓴이',
  postCount: 3,
  ...over,
});

function renderList(initial = '/series') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/series" element={<SeriesList />} />
          <Route path="/series/:slug" element={<div>DETAIL</div>} />
          <Route path="/users/:id" element={<div>USER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SeriesList 페이지 (T-WEB-503)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('시리즈 카드 목록(제목·설명·글수·작성자)을 렌더하고 카드가 /series/:slug 링크다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { items: [summary()], page: 1, pageSize: 20, total: 1 },
    });
    renderList();
    expect(
      await screen.findByRole('link', { name: /React 입문/ }),
    ).toHaveAttribute('href', '/series/react-입문');
    expect(screen.getByText('초보용 연재')).toBeInTheDocument();
    expect(screen.getByText(/3편/)).toBeInTheDocument();
    expect(screen.getByText('글쓴이')).toBeInTheDocument();
  });

  it('useSeriesList 가 /series 를 page/pageSize 로 호출한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { items: [summary()], page: 1, pageSize: 20, total: 1 },
    });
    renderList();
    await screen.findByRole('link', { name: /React 입문/ });
    expect(mockedApi.get).toHaveBeenCalledWith('/series', {
      params: { page: 1, pageSize: 20 },
    });
  });

  it('시리즈가 없으면 안내 문구를 보여준다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { items: [], page: 1, pageSize: 20, total: 0 },
    });
    renderList();
    expect(
      await screen.findByText('아직 시리즈가 없습니다.'),
    ).toBeInTheDocument();
  });
});
