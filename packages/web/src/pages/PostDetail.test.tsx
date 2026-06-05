import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from '../lib/api';
import { PostDetail } from './PostDetail';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

// 현재 경로를 노출하는 프로브(리다이렉트 검증용)
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderDetail(id = 'p1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/posts/${id}`]}>
        <Routes>
          <Route
            path="/posts/:slug"
            element={
              <>
                <PostDetail />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'p1', // 라우트 param 과 동일 → 리다이렉트 없음
  title: '상세 제목',
  contentMarkdown: '# 본문 헤딩\n\n내용 단락',
  contentHtml: '<h1>본문 헤딩</h1><p>내용 단락</p>',
  tags: ['nestjs', 'ddd'],
  status: 'PUBLISHED',
  authorId: 'u1',
  authorName: '홍길동',
  publishedAt: '2026-06-01T09:00:00.000Z',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-06-01T09:00:00.000Z',
  viewCount: 42,
  likeCount: 3,
  likedByMe: false,
  ...over,
});

// 상세 GET 은 detail, 댓글·관련글 GET 은 빈 배열, view/like POST·DELETE 는 기본 resolve.
function mockApiWith(over: Record<string, unknown> = {}) {
  mockedApi.get.mockImplementation((url: string) =>
    url.endsWith('/comments') || url.endsWith('/related')
      ? Promise.resolve({ data: [] })
      : Promise.resolve({ data: detail(over) }),
  );
  mockedApi.post.mockResolvedValue({ data: { viewCount: 43 } });
  mockedApi.delete.mockResolvedValue({
    data: { likeCount: 2, likedByMe: false },
  });
}

describe('PostDetail 페이지', () => {
  beforeEach(() => vi.clearAllMocks());

  it('제목, 발행일, Tag, 마크다운 본문을 렌더한다', async () => {
    mockApiWith();
    renderDetail('p1');

    expect(await screen.findByText('상세 제목')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '본문 헤딩' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2026년 6월 1일')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('#nestjs')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/posts/p1');
  });

  it('에러(초안/없음 404) 시 에러 메시지를 보여준다', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('404'));
    renderDetail('nope');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  // ADR-0022: cuid 로 들어오면 canonical 슬러그 URL 로 replace
  it('cuid 로 진입하면 슬러그 URL 로 교체한다', async () => {
    mockApiWith({ id: 'cuid123', slug: 'nestjs-입문' });
    renderDetail('cuid123');
    await screen.findByText('상세 제목');
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/posts/nestjs-입문'),
    );
  });

  // ADR-0024: 조회수 표시 + 마운트 시 view 핑 1회
  it('조회수를 표시하고 마운트 시 view 를 1회 기록한다', async () => {
    mockApiWith();
    renderDetail('p1');
    await screen.findByText('상세 제목');
    expect(screen.getByLabelText('조회수')).toHaveTextContent('42');
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/view'),
    );
  });

  // ADR-0024: 좋아요 버튼 표시 + 클릭 시 낙관적 증가 + POST 호출
  it('좋아요 버튼을 누르면 낙관적으로 증가하고 POST 한다', async () => {
    mockApiWith();
    mockedApi.post.mockImplementation((url: string) =>
      url.endsWith('/like')
        ? Promise.resolve({ data: { likeCount: 4, likedByMe: true } })
        : Promise.resolve({ data: { viewCount: 43 } }),
    );
    renderDetail('p1');

    const btn = await screen.findByRole('button', { name: '좋아요' });
    expect(btn).toHaveTextContent('3');
    btn.click();
    // 낙관적 업데이트 → 즉시 4 + aria-pressed
    await waitFor(() => expect(btn).toHaveTextContent('4'));
    expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/like');
  });
});
