import type { CommentDto } from '@blog/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { CommentTree } from './CommentTree';

const tree: CommentDto[] = [
  {
    id: 'c0',
    postId: 'p1',
    parentId: null,
    depth: 0,
    userId: null,
    authorName: '익명',
    displayName: '익명',
    body: '최상위 댓글',
    createdAt: '2026-06-01T10:00:00.000Z',
    replies: [
      {
        id: 'c1',
        postId: 'p1',
        parentId: 'c0',
        depth: 1,
        userId: null,
        authorName: null,
        displayName: null,
        body: '첫 번째 답글',
        createdAt: '2026-06-01T10:05:00.000Z',
        replies: [
          {
            id: 'c2',
            postId: 'p1',
            parentId: 'c1',
            depth: 2,
            userId: null,
            authorName: null,
            displayName: null,
            body: '답글의 답글',
            createdAt: '2026-06-01T10:10:00.000Z',
            replies: [],
          },
        ],
      },
    ],
  },
];

function renderTree() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CommentTree comments={tree} postId="p1" />
    </QueryClientProvider>,
  );
}

describe('CommentTree', () => {
  it('depth 0→1→2 중첩 댓글을 모두 렌더한다', () => {
    renderTree();
    expect(screen.getByText('최상위 댓글')).toBeInTheDocument();
    expect(screen.getByText('첫 번째 답글')).toBeInTheDocument();
    expect(screen.getByText('답글의 답글')).toBeInTheDocument();
  });

  it('깊이 2 댓글에는 답글 버튼이 없다(깊이 0·1 에만 존재)', () => {
    renderTree();
    expect(screen.getAllByRole('button', { name: '답글' })).toHaveLength(2);
  });
});
