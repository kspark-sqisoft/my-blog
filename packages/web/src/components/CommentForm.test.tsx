import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { api } from '../lib/api';
import { CommentForm } from './CommentForm';

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };

function renderForm(props: { postId?: string; parentId?: string } = {}) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CommentForm postId={props.postId ?? 'p1'} parentId={props.parentId} />
    </QueryClientProvider>,
  );
}

describe('CommentForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('body 가 비어 있으면 등록 버튼이 비활성이다', () => {
    renderForm();
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
  });

  it('작성 후 등록하면 POST /posts/:postId/comments 를 호출한다', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1' } });
    renderForm();
    fireEvent.change(screen.getByLabelText('댓글 내용'), {
      target: { value: '좋은 글이네요' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/comments', {
        body: '좋은 글이네요',
      }),
    );
  });

  it('parentId 가 있으면 답글로 전송한다', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c2' } });
    renderForm({ parentId: 'c1' });
    fireEvent.change(screen.getByLabelText('댓글 내용'), {
      target: { value: '답글입니다' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/comments', {
        body: '답글입니다',
        parentId: 'c1',
      }),
    );
  });
});
