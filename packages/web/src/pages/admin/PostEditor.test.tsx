import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { api } from '../../lib/api';
import { PostEditor } from './PostEditor';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

function renderEditor(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/posts/new" element={<PostEditor />} />
          <Route path="/admin/posts/:id/edit" element={<PostEditor />} />
          <Route path="/admin" element={<div>ADMIN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PostEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('새 글 작성: 제목/본문 입력 후 저장 → POST /posts', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'newid' } });
    renderEditor('/admin/posts/new');

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '새 제목' },
    });
    fireEvent.change(screen.getByLabelText('본문(마크다운)'), {
      target: { value: '# 본문' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts', {
        title: '새 제목',
        contentMarkdown: '# 본문',
        tags: [],
      }),
    );
  });

  it('수정 모드: 기존 값을 admin 단건에서 로드하고 PATCH 한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        id: 'p1',
        title: '기존 제목',
        contentMarkdown: '기존 본문',
        tags: ['nestjs'],
        status: 'DRAFT',
        authorId: 'u1',
        publishedAt: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    });
    mockedApi.patch.mockResolvedValueOnce({ data: { id: 'p1' } });
    renderEditor('/admin/posts/p1/edit');

    // 기존 값 로드 확인
    expect(await screen.findByDisplayValue('기존 제목')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/posts/p1');

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '수정 제목' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/posts/p1',
        expect.objectContaining({ title: '수정 제목' }),
      ),
    );
  });

  it('Tag 6개 이상이면 클라이언트 검증으로 저장이 막힌다', async () => {
    renderEditor('/admin/posts/new');
    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 't' },
    });
    fireEvent.change(screen.getByLabelText('본문(마크다운)'), {
      target: { value: 'b' },
    });
    fireEvent.change(screen.getByLabelText('태그(쉼표로 구분)'), {
      target: { value: 'a,b,c,d,e,f' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('태그');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('이미지 업로드 시 POST /uploads 후 본문에 마크다운 이미지가 삽입된다', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { url: '/uploads/abc.png', contentType: 'image/png', size: 10 },
    });
    renderEditor('/admin/posts/new');

    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    const input = screen.getByLabelText('이미지 업로드');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/uploads',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        }),
      ),
    );
    await waitFor(() => {
      const textarea = screen.getByLabelText(
        '본문(마크다운)',
      ) as HTMLTextAreaElement;
      expect(textarea.value).toContain('![pic.png](/uploads/abc.png)');
    });
  });
});
