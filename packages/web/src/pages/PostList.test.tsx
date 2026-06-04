import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from '../lib/api';
import { PostList } from './PostList';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function renderList(initial = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<PostList />} />
          <Route path="/posts/:id" element={<div>DETAIL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const summary = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: '첫 글',
  summary: '요약',
  tags: ['nestjs'],
  authorName: '홍길동',
  publishedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

describe('PostList 페이지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('발행 글 목록을 렌더한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { items: [summary()], page: 1, pageSize: 10, total: 1 },
    });
    renderList();
    expect(await screen.findByText('첫 글')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
      params: { page: 1, pageSize: 10 },
    });
  });

  it('로딩 중에는 상태 표시를 보여준다', () => {
    mockedApi.get.mockReturnValueOnce(new Promise(() => {}));
    renderList();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('글이 없으면 빈 상태 메시지를 보여준다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { items: [], page: 1, pageSize: 10, total: 0 },
    });
    renderList();
    expect(await screen.findByText(/글이 없습니다/)).toBeInTheDocument();
  });

  it('에러 시 에러 메시지를 보여준다', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('fail'));
    renderList();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('다음 페이지로 이동하면 page=2 로 다시 조회한다', async () => {
    mockedApi.get.mockResolvedValue({
      data: { items: [summary()], page: 1, pageSize: 10, total: 25 },
    });
    renderList();
    await screen.findByText('첫 글');
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
        params: { page: 2, pageSize: 10 },
      }),
    );
  });
});
