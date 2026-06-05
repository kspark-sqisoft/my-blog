import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }));

import { api } from '../lib/api';
import { RelatedPosts } from './RelatedPosts';

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function renderRelated(idOrSlug = 'src') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RelatedPosts idOrSlug={idOrSlug} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const item = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  slug: 'rel-1',
  title: '관련글1',
  tags: ['a'],
  publishedAt: '2026-06-01T00:00:00.000Z',
  coverImageUrl: null,
  ...over,
});

describe('RelatedPosts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('관련 글이 있으면 카드 목록과 섹션 제목을 렌더한다', async () => {
    mockedApi.get.mockResolvedValue({
      data: [item(), item({ id: 'r2', slug: 'rel-2', title: '관련글2' })],
    });
    renderRelated('src');

    expect(await screen.findByText('관련글1')).toBeInTheDocument();
    expect(screen.getByText('관련글2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '관련 글' }),
    ).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith(
      '/posts/src/related',
      expect.anything(),
    );
  });

  it('관련 글이 비면 아무것도 렌더하지 않는다(섹션 숨김)', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    const { container } = renderRelated('src');
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    expect(container.querySelector('.ab-related')).toBeNull();
  });

  it('에러 시 아무것도 렌더하지 않는다', async () => {
    mockedApi.get.mockRejectedValue(new Error('500'));
    const { container } = renderRelated('src');
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    expect(container.querySelector('.ab-related')).toBeNull();
  });
});
