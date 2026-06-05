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
      data: { items: [summary()], page: 1, pageSize: 20, total: 1 },
    });
    renderList();
    expect(await screen.findByText('첫 글')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
      params: { page: 1, pageSize: 20 },
    });
  });

  it('로딩 중에는 상태 표시를 보여준다', () => {
    mockedApi.get.mockReturnValueOnce(new Promise(() => {}));
    renderList();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('글이 없으면 빈 상태 메시지를 보여준다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { items: [], page: 1, pageSize: 20, total: 0 },
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
      data: { items: [summary()], page: 1, pageSize: 20, total: 25 },
    });
    renderList();
    await screen.findByText('첫 글');
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
        params: { page: 2, pageSize: 20 },
      }),
    );
  });

  // T-WEB-308: 제목·본문 키워드 검색(디바운스, 비우면 전체)
  it('검색어 입력 시 디바운스 후 q 파라미터로 조회한다', async () => {
    mockedApi.get.mockResolvedValue({
      data: { items: [summary()], page: 1, pageSize: 20, total: 1 },
    });
    renderList();
    await screen.findByText('첫 글');
    fireEvent.change(screen.getByLabelText('글 검색'), {
      target: { value: 'nest' },
    });
    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenCalledWith('/posts', {
        params: { page: 1, pageSize: 20, q: 'nest' },
      }),
    );
  });

  it('검색어를 비우면 q 없이(전체) 다시 조회한다', async () => {
    mockedApi.get.mockResolvedValue({
      data: { items: [summary()], page: 1, pageSize: 20, total: 1 },
    });
    renderList('/?q=nest');
    await screen.findByText('첫 글');
    const input = screen.getByLabelText('글 검색') as HTMLInputElement;
    expect(input.value).toBe('nest'); // URL q 로 초기화
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() =>
      expect(mockedApi.get).toHaveBeenLastCalledWith('/posts', {
        params: { page: 1, pageSize: 20 },
      }),
    );
  });

  // T-WEB-203: 목록 카드 비디오 첫 프레임 커버 (ADR-0020)
  it('coverImageUrl 이 .mp4 면 카드 커버에 <video> 첫 프레임을 표시한다 (controls 없음)', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [summary({ coverImageUrl: '/uploads/clip.mp4' })],
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
    const { container } = renderList();
    await screen.findByText('첫 글');
    const video = container.querySelector(
      'video.ab-card-cover',
    ) as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/uploads/clip.mp4');
    expect(video?.getAttribute('preload')).toBe('metadata');
    // muted/playsInline 은 React 가 DOM property 로 설정한다 (attribute 가 아닐 수 있음).
    expect(video?.muted).toBe(true);
    expect(video?.playsInline).toBe(true);
    // 카드 인라인 재생을 막기 위해 controls 는 없어야 한다 (클릭 → 상세 이동만)
    expect(video?.controls).toBe(false);
    // 비디오 카드는 <img> 를 사용하지 않는다
    expect(container.querySelector('img.ab-card-cover')).toBeNull();
  });

  it('coverImageUrl 이 이미지(.jpg) 면 기존 <img> 커버를 유지한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        items: [summary({ coverImageUrl: '/uploads/a.jpg' })],
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
    const { container } = renderList();
    await screen.findByText('첫 글');
    expect(container.querySelector('img.ab-card-cover')).not.toBeNull();
    expect(container.querySelector('video.ab-card-cover')).toBeNull();
  });
});
