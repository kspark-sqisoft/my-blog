import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from '../lib/api';
import { PostDetail } from './PostDetail';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function renderDetail(id = 'p1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/posts/${id}`]}>
        <Routes>
          <Route path="/posts/:id" element={<PostDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: '상세 제목',
  contentMarkdown: '# 본문 헤딩\n\n내용 단락',
  tags: ['nestjs', 'ddd'],
  status: 'PUBLISHED',
  authorId: 'u1',
  publishedAt: '2026-06-01T09:00:00.000Z',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-06-01T09:00:00.000Z',
  ...over,
});

describe('PostDetail 페이지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('제목, 발행일, Tag, 마크다운 본문을 렌더한다', async () => {
    mockedApi.get.mockImplementation((url: string) =>
      url.endsWith('/comments')
        ? Promise.resolve({ data: [] })
        : Promise.resolve({ data: detail() }),
    );
    renderDetail('p1');

    expect(await screen.findByText('상세 제목')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '본문 헤딩' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
    expect(screen.getByText('#nestjs')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/posts/p1');
  });

  it('에러(초안/없음 404) 시 에러 메시지를 보여준다', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('404'));
    renderDetail('nope');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
