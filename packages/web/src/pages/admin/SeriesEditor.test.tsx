import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@blog/shared';

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { useAuth } from '../../auth/useAuth';
import { api } from '../../lib/api';
import { SeriesEditor } from './SeriesEditor';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const seriesDetail = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  slug: 's-1',
  title: '원제목',
  description: '원설명',
  authorId: 'u1',
  authorName: '나',
  postCount: 0,
  posts: [] as unknown[],
  ...over,
});

const postSummary = (id: string, title: string) => ({
  id,
  slug: id,
  title,
  summary: '',
  tags: [],
  authorId: 'u1',
  authorName: '나',
  authorAvatarUrl: null,
  publishedAt: '2026-06-01T00:00:00.000Z',
  coverImageUrl: null,
  viewCount: 0,
  likeCount: 0,
});

function setUser(role: UserRole, id = 'u1') {
  useAuth.setState({
    status: 'authenticated',
    user: { id, email: 'me@x.com', name: '나', role, avatarUrl: null, bio: null },
    error: null,
  });
}

// /series/:id → 상세, /posts → 작성자 발행글 목록
function mockApi(detail = seriesDetail(), authorPosts = [postSummary('p1', '글1')]) {
  mockedApi.get.mockImplementation((url: string) =>
    url.startsWith('/series/')
      ? Promise.resolve({ data: detail })
      : Promise.resolve({
          data: {
            items: authorPosts,
            page: 1,
            pageSize: 100,
            total: authorPosts.length,
          },
        }),
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderEditor(id = 's1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/series/${id}/edit`]}>
        <Routes>
          <Route
            path="/admin/series/:id/edit"
            element={
              <>
                <SeriesEditor />
                <LocationProbe />
              </>
            }
          />
          <Route path="/admin/series" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SeriesEditor (/admin/series/:id/edit, T-WEB-504)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('AUTHOR', 'u1');
  });

  it('기존 시리즈 제목·설명을 폼에 로드한다', async () => {
    mockApi();
    renderEditor();
    expect(
      ((await screen.findByLabelText('제목')) as HTMLInputElement).value,
    ).toBe('원제목');
    expect((screen.getByLabelText('설명') as HTMLTextAreaElement).value).toBe(
      '원설명',
    );
  });

  it('제목·설명 수정 후 저장하면 PATCH /series/:id', async () => {
    mockApi();
    mockedApi.patch.mockResolvedValueOnce({ data: seriesDetail() });
    renderEditor();
    await screen.findByLabelText('제목');
    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '새제목' },
    });
    fireEvent.click(screen.getByRole('button', { name: '정보 저장' }));
    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith('/series/s1', {
        title: '새제목',
        description: '원설명',
      }),
    );
  });

  it('설명 500자 초과면 에러, PATCH 하지 않는다', async () => {
    mockApi();
    renderEditor();
    await screen.findByLabelText('제목');
    fireEvent.change(screen.getByLabelText('설명'), {
      target: { value: 'a'.repeat(501) },
    });
    fireEvent.click(screen.getByRole('button', { name: '정보 저장' }));
    expect(await screen.findByText(/500자 이하/)).toBeInTheDocument();
    expect(mockedApi.patch).not.toHaveBeenCalled();
  });

  it('발행글을 추가하고 순서 저장하면 PUT /series/:id/posts', async () => {
    mockApi(seriesDetail({ posts: [] }), [postSummary('p1', '글1')]);
    mockedApi.put.mockResolvedValueOnce({ data: seriesDetail() });
    renderEditor();
    await screen.findByLabelText('제목');
    // 추가 가능한 글 "글1" 추가
    fireEvent.click(await screen.findByRole('button', { name: '글1 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '순서 저장' }));
    await waitFor(() =>
      expect(mockedApi.put).toHaveBeenCalledWith('/series/s1/posts', {
        postIds: ['p1'],
      }),
    );
  });

  it('두 글을 추가하고 순서를 바꿔 저장하면 바뀐 순서로 PUT 한다', async () => {
    mockApi(seriesDetail({ posts: [] }), [
      postSummary('p1', '글1'),
      postSummary('p2', '글2'),
    ]);
    mockedApi.put.mockResolvedValueOnce({ data: seriesDetail() });
    renderEditor();
    await screen.findByLabelText('제목');
    fireEvent.click(await screen.findByRole('button', { name: '글1 추가' }));
    fireEvent.click(await screen.findByRole('button', { name: '글2 추가' }));
    // 현재 순서 [p1, p2] → 글1을 아래로 → [p2, p1]
    fireEvent.click(screen.getByRole('button', { name: '아래로: 글1' }));
    fireEvent.click(screen.getByRole('button', { name: '순서 저장' }));
    await waitFor(() =>
      expect(mockedApi.put).toHaveBeenCalledWith('/series/s1/posts', {
        postIds: ['p2', 'p1'],
      }),
    );
  });

  it('삭제하면 DELETE 후 목록으로 이동', async () => {
    mockApi();
    mockedApi.delete.mockResolvedValueOnce({ data: {} });
    renderEditor();
    await screen.findByLabelText('제목');
    fireEvent.click(screen.getByRole('button', { name: '시리즈 삭제' }));
    await waitFor(() =>
      expect(mockedApi.delete).toHaveBeenCalledWith('/series/s1'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/admin/series'),
    );
  });
});
