import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }));

import { api } from '../lib/api';
import { SeriesDetail } from './SeriesDetail';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const post = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'p1',
  title: '첫 번째 글',
  summary: '요약',
  tags: [],
  authorId: 'u1',
  authorName: '카드저자',
  authorAvatarUrl: null,
  publishedAt: '2026-06-01T00:00:00.000Z',
  coverImageUrl: null,
  viewCount: 0,
  likeCount: 0,
  seriesOrder: 0,
  ...over,
});

const series = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 'react-입문',
  title: 'React 입문',
  description: '초보용 연재',
  authorId: 'u1',
  authorName: '시리즈저자',
  postCount: 1,
  posts: [post()],
  ...over,
});

function renderAt(slug = 'react-입문') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/series/${slug}`]}>
        <Routes>
          <Route path="/series/:slug" element={<SeriesDetail />} />
          <Route path="/posts/:slug" element={<div>POST</div>} />
          <Route path="/users/:id" element={<div>USER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SeriesDetail 페이지 (T-WEB-501)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('헤더(제목·설명·작성자 링크) + 발행글 목록을 렌더한다', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: series() });
    renderAt('react-입문');
    expect(
      await screen.findByRole('heading', { name: 'React 입문' }),
    ).toBeInTheDocument();
    expect(screen.getByText('초보용 연재')).toBeInTheDocument();
    // 헤더 작성자 링크
    expect(screen.getByRole('link', { name: '시리즈저자' })).toHaveAttribute(
      'href',
      '/users/u1',
    );
    // 발행글 카드(제목)
    expect(screen.getByText('첫 번째 글')).toBeInTheDocument();
  });

  it('useSeries 가 /series/:slug 를 호출한다', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: series() });
    renderAt('react-입문');
    await screen.findByRole('heading', { name: 'React 입문' });
    expect(mockedApi.get).toHaveBeenCalledWith('/series/react-%EC%9E%85%EB%AC%B8');
  });

  it('발행글이 없으면 안내 문구를 보여준다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: series({ posts: [], postCount: 0 }),
    });
    renderAt('react-입문');
    expect(
      await screen.findByText('아직 발행된 글이 없습니다.'),
    ).toBeInTheDocument();
  });

  it('없는 시리즈(404)면 에러 상태를 보여준다', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('404'));
    renderAt('nope');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('발행글 카드의 작성자 이름이 /users/:authorId 링크다', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: series() });
    renderAt('react-입문');
    const link = await screen.findByRole('link', { name: '카드저자' });
    expect(link).toHaveAttribute('href', '/users/u1');
  });
});
