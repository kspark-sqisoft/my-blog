import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from '../lib/api';
import { TagPosts } from './TagPosts';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function renderAtTag(tag: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/tags/${tag}`]}>
        <Routes>
          <Route path="/tags/:name" element={<TagPosts />} />
          <Route path="/posts/:id" element={<div>DETAIL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TagPosts 페이지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('태그로 필터된 목록을 조회·렌더한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'p1',
            title: '태그 글',
            summary: '',
            tags: ['nestjs'],
            publishedAt: null,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    });
    renderAtTag('nestjs');
    expect(await screen.findByText('태그 글')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
      params: { page: 1, pageSize: 10, tag: 'nestjs' },
    });
  });
});
