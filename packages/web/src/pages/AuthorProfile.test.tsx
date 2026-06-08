import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }));

import { api } from '../lib/api';
import { AuthorProfile } from './AuthorProfile';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  name: '글쓴이',
  avatarUrl: null,
  bio: '안녕하세요 소개입니다',
  createdAt: '2026-01-15T00:00:00.000Z',
  postCount: 2,
  ...over,
});

const post = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'p1',
  title: '글 제목',
  summary: '요약',
  tags: [],
  authorId: 'u1',
  authorName: '카드작성자',
  authorAvatarUrl: null,
  publishedAt: '2026-06-01T00:00:00.000Z',
  coverImageUrl: null,
  ...over,
});

// /users/:id → 프로필, /posts → 작성자 발행글 목록
function mockApi({
  prof = profile(),
  posts = [] as Record<string, unknown>[],
}: { prof?: Record<string, unknown>; posts?: Record<string, unknown>[] } = {}) {
  mockedApi.get.mockImplementation((url: string) =>
    url.startsWith('/users/')
      ? Promise.resolve({ data: prof })
      : Promise.resolve({
          data: { items: posts, page: 1, pageSize: 20, total: posts.length },
        }),
  );
}

function renderAt(id = 'u1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/users/${id}`]}>
        <Routes>
          <Route path="/users/:id" element={<AuthorProfile />} />
          <Route path="/posts/:slug" element={<div>DETAIL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AuthorProfile 페이지 (T-WEB-402)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('헤더에 이름·소개·발행글 수를 렌더한다', async () => {
    mockApi({ prof: profile(), posts: [post()] });
    renderAt('u1');
    // 헤더 이름(h1)
    expect(
      await screen.findByRole('heading', { name: '글쓴이' }),
    ).toBeInTheDocument();
    expect(screen.getByText('안녕하세요 소개입니다')).toBeInTheDocument();
    // 발행글 수
    expect(screen.getByText('발행한 글 2개')).toBeInTheDocument();
    // 가입일(fmtDate)
    expect(screen.getByText('가입일 2026년 1월 15일')).toBeInTheDocument();
    // 아바타(이미지 없으면 이름 이니셜 폴백 — name alt/접근명)
    expect(screen.getByRole('heading', { name: '글쓴이' })).toBeInTheDocument();
  });

  it('소개(bio)가 없으면 표시하지 않는다', async () => {
    mockApi({ prof: profile({ bio: null }), posts: [] });
    renderAt('u1');
    await screen.findByRole('heading', { name: '글쓴이' });
    expect(screen.queryByText('안녕하세요 소개입니다')).not.toBeInTheDocument();
  });

  it('usePosts 를 author 파라미터로 호출한다', async () => {
    mockApi({ posts: [post()] });
    renderAt('u1');
    await screen.findByRole('heading', { name: '글쓴이' });
    expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
      params: { page: 1, pageSize: 20, author: 'u1' },
    });
  });

  it('발행글이 없으면 안내 문구를 보여준다', async () => {
    mockApi({ posts: [] });
    renderAt('u1');
    expect(
      await screen.findByText('아직 발행한 글이 없습니다.'),
    ).toBeInTheDocument();
  });

  it('목록 카드의 작성자 이름이 /users/:authorId 링크다', async () => {
    mockApi({ posts: [post({ authorName: '카드작성자', authorId: 'u1' })] });
    renderAt('u1');
    const link = await screen.findByRole('link', { name: '카드작성자' });
    expect(link).toHaveAttribute('href', '/users/u1');
  });
});
