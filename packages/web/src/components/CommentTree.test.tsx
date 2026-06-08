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
    authorAvatarUrl: null,
    parentId: null,
    depth: 0,
    userId: null,
    authorName: '익명',
    displayName: '익명',
    body: '최상위 댓글',
    createdAt: '2026-06-01T10:00:00.000Z',
    editedAt: null,
    isEdited: false,
    isDeleted: false,
    replies: [
      {
        id: 'c1',
        postId: 'p1',
        authorAvatarUrl: null,
        parentId: 'c0',
        depth: 1,
        userId: null,
        authorName: null,
        displayName: null,
        body: '첫 번째 답글',
        createdAt: '2026-06-01T10:05:00.000Z',
        editedAt: null,
        isEdited: false,
        isDeleted: false,
        replies: [
          {
            id: 'c2',
            postId: 'p1',
            authorAvatarUrl: null,
            parentId: 'c1',
            depth: 2,
            userId: null,
            authorName: null,
            displayName: null,
            body: '답글의 답글',
            createdAt: '2026-06-01T10:10:00.000Z',
            editedAt: null,
            isEdited: false,
            isDeleted: false,
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

  // T-WEB-015 AC2: 표시 이름은 authorName 을 우선 사용한다
  it('authorName 을 작성자 이름으로 표시한다', () => {
    const qc = new QueryClient();
    const comments: CommentDto[] = [
      {
        id: 'm0',
        postId: 'p1',
        authorAvatarUrl: null,
        parentId: null,
        depth: 0,
        userId: 'u1',
        authorName: '박기순',
        displayName: null,
        body: '회원 댓글',
        createdAt: '2026-06-01T10:00:00.000Z',
        editedAt: null,
        isEdited: false,
        isDeleted: false,
        replies: [],
      },
    ];
    render(
      <QueryClientProvider client={qc}>
        <CommentTree comments={comments} postId="p1" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('박기순')).toBeInTheDocument();
  });

  // T-WEB-015 AC2: authorName 이 displayName 보다 우선한다
  it('authorName 이 있으면 displayName 대신 authorName 을 표시한다', () => {
    const qc = new QueryClient();
    const comments: CommentDto[] = [
      {
        id: 'm1',
        postId: 'p1',
        authorAvatarUrl: null,
        parentId: null,
        depth: 0,
        userId: 'u1',
        authorName: '실명사용자',
        displayName: '익명입력',
        body: '우선순위 댓글',
        createdAt: '2026-06-01T10:00:00.000Z',
        editedAt: null,
        isEdited: false,
        isDeleted: false,
        replies: [],
      },
    ];
    render(
      <QueryClientProvider client={qc}>
        <CommentTree comments={comments} postId="p1" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('실명사용자')).toBeInTheDocument();
    expect(screen.queryByText('익명입력')).not.toBeInTheDocument();
  });
});
