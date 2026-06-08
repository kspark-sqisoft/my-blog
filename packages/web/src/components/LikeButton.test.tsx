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
import { useAuth } from '../auth/useAuth';
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

const setAuthed = (authed: boolean) =>
  useAuth.setState({
    status: authed ? 'authenticated' : 'unauthenticated',
    user: authed
      ? {
          id: 'me',
          email: 'me@x.com',
          name: '나',
          role: 'MEMBER',
          avatarUrl: null,
          bio: null,
        }
      : null,
    error: null,
  });

describe('LikeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.setState({ user: null, status: 'idle', error: null });
  });

  // 회귀(H2): 비로그인이면 API 호출 없이 /login 으로 즉시 이동한다.
  // (구버전: 무조건 toggleLike → 401 응답 → /login. 사용자는 알 수 없는 점프로 느낀다.)
  it('비로그인 클릭 → API 호출 없이 즉시 /login 으로 이동', async () => {
    setAuthed(false);
    renderButton(post({ likedByMe: false }));

    screen.getByRole('button', { name: '좋아요' }).click();

    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/login'),
    );
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  // 회귀(H3): 비로그인 호버 시 title 로 "로그인 후 좋아요" 안내.
  it('비로그인 상태면 버튼 title 로 로그인 안내가 보인다', () => {
    setAuthed(false);
    renderButton(post({ likedByMe: false }));
    expect(
      screen.getByRole('button', { name: '좋아요' }),
    ).toHaveAttribute('title', '로그인 후 좋아요를 누를 수 있습니다');
  });

  // 회귀: 부팅 직후 idle(=세션 미확인) 상태에서 클릭하면 즉시 /login 으로 튕기지 않고
  // API 호출을 시도한다. 실제 쿠키 세션이 있는 사용자가 잘못 튕기는 회귀를 막는다.
  it('idle 상태에서는 즉시 /login 으로 튕기지 않고 API 호출을 시도한다', async () => {
    useAuth.setState({ user: null, status: 'idle', error: null });
    mockedApi.post.mockResolvedValueOnce({
      data: { likeCount: 2, likedByMe: true },
    });
    renderButton(post({ likedByMe: false }));

    screen.getByRole('button', { name: '좋아요' }).click();

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/like'),
    );
    expect(screen.getByTestId('loc').textContent).toBe('/posts/p1');
    // title 도 일반 라벨이어야 한다(잘못된 "로그인 후 좋아요" 안내 금지).
    expect(
      screen.getByRole('button', { name: '좋아요' }),
    ).toHaveAttribute('title', '좋아요');
  });

  it('인증 + 좋아요 안 누른 상태 → POST 호출, 401 응답이면 /login 으로 이동(백업)', async () => {
    setAuthed(true);
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
    setAuthed(true);
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
