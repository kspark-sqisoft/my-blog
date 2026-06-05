import type { PostDetailDto } from '@blog/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn(), delete: vi.fn() },
}));

import { api } from '../lib/api';
import { LikeButton } from './LikeButton';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const post = (over: Partial<PostDetailDto> = {}): PostDetailDto =>
  ({
    id: 'p1',
    slug: 'p1',
    title: 't',
    contentMarkdown: '',
    contentHtml: '',
    tags: [],
    status: 'PUBLISHED',
    authorId: 'u1',
    authorName: 'a',
    publishedAt: null,
    createdAt: '',
    updatedAt: '',
    viewCount: 0,
    likeCount: 1,
    likedByMe: false,
    ...over,
  }) as PostDetailDto;

function renderButton(p: PostDetailDto) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/posts/p1']}>
        <Routes>
          <Route
            path="/posts/:slug"
            element={<LikeButton post={p} />}
          />
          <Route path="/login" element={<div>로그인 페이지</div>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

describe('LikeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('비로그인 클릭 → 401 이면 /login 으로 이동', async () => {
    mockedApi.post.mockRejectedValue(
      new AxiosError('unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 401,
      } as never),
    );
    renderButton(post({ likedByMe: false }));

    screen.getByRole('button', { name: '좋아요' }).click();

    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/login'),
    );
    expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/like');
  });

  it('이미 좋아요한 상태면 클릭 시 DELETE 한다', async () => {
    mockedApi.delete.mockResolvedValue({
      data: { likeCount: 0, likedByMe: false },
    });
    renderButton(post({ likedByMe: true, likeCount: 1 }));

    screen.getByRole('button', { name: '좋아요 취소' }).click();
    await waitFor(() =>
      expect(mockedApi.delete).toHaveBeenCalledWith('/posts/p1/like'),
    );
  });
});
