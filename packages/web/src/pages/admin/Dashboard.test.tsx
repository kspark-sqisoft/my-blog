import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../lib/api';
import { Dashboard } from './Dashboard';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const adminList = {
  data: {
    items: [
      {
        id: 'd1',
        title: '대시 초안',
        status: 'DRAFT',
        tags: [],
        publishedAt: null,
        createdAt: '2026-06-02T00:00:00.000Z',
      },
      {
        id: 'p1',
        title: '대시 발행',
        status: 'PUBLISHED',
        tags: [],
        publishedAt: '2026-06-01T00:00:00.000Z',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ],
    page: 1,
    pageSize: 50,
    total: 2,
  },
};

describe('운영자 Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(adminList);
    mockedApi.post.mockResolvedValue({ data: {} });
    mockedApi.delete.mockResolvedValue({ data: {} });
  });

  it('초안+발행 글을 함께 보여준다', async () => {
    renderDashboard();
    expect(await screen.findByText('대시 초안')).toBeInTheDocument();
    expect(screen.getByText('대시 발행')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/posts', {
      params: { page: 1, pageSize: 50 },
    });
  });

  it('초안의 발행 버튼 → publish API 호출', async () => {
    renderDashboard();
    await screen.findByText('대시 초안');
    fireEvent.click(screen.getByRole('button', { name: '발행' }));
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/d1/publish'),
    );
  });

  it('발행글의 발행취소 버튼 → unpublish API 호출', async () => {
    renderDashboard();
    await screen.findByText('대시 발행');
    fireEvent.click(screen.getByRole('button', { name: '발행취소' }));
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/unpublish'),
    );
  });

  it('삭제 버튼 → delete API 호출', async () => {
    renderDashboard();
    await screen.findByText('대시 초안');
    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    await waitFor(() =>
      expect(mockedApi.delete).toHaveBeenCalledWith('/posts/d1'),
    );
  });
});
