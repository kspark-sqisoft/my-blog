import type { CommentDto, UserRole } from '@blog/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/useAuth';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }));

import { CommentTree } from './CommentTree';

type UserLike = { id: string; role: UserRole; name: string } | null;
const mockUseAuth = vi.mocked(useAuth);
function setUser(user: UserLike) {
  (mockUseAuth as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
    (sel: (s: { user: UserLike }) => unknown) => sel({ user }),
  );
}

beforeEach(() => {
  setUser(null); // 기본: 비로그인
});

// CommentDto 기본값 + 오버라이드(신규 필드 editedAt/isEdited/isDeleted 포함)
function makeComment(over: Partial<CommentDto> & { id: string }): CommentDto {
  return {
    postId: 'p1',
    parentId: null,
    depth: 0,
    userId: null,
    authorName: null,
    authorAvatarUrl: null,
    displayName: null,
    body: '',
    createdAt: '2026-06-01T10:00:00.000Z',
    editedAt: null,
    isEdited: false,
    isDeleted: false,
    replies: [],
    ...over,
  };
}

function renderTree(comments: CommentDto[], postAuthorId?: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CommentTree
        comments={comments}
        postId="p1"
        postAuthorId={postAuthorId}
      />
    </QueryClientProvider>,
  );
}

const tree: CommentDto[] = [
  makeComment({
    id: 'c0',
    authorName: '익명',
    displayName: '익명',
    body: '최상위 댓글',
    replies: [
      makeComment({
        id: 'c1',
        parentId: 'c0',
        depth: 1,
        body: '첫 번째 답글',
        replies: [
          makeComment({
            id: 'c2',
            parentId: 'c1',
            depth: 2,
            body: '답글의 답글',
          }),
        ],
      }),
    ],
  }),
];

describe('CommentTree', () => {
  it('depth 0→1→2 중첩 댓글을 모두 렌더한다', () => {
    renderTree(tree);
    expect(screen.getByText('최상위 댓글')).toBeInTheDocument();
    expect(screen.getByText('첫 번째 답글')).toBeInTheDocument();
    expect(screen.getByText('답글의 답글')).toBeInTheDocument();
  });

  it('깊이 2 댓글에는 답글 버튼이 없다(깊이 0·1 에만 존재)', () => {
    renderTree(tree);
    expect(screen.getAllByRole('button', { name: '답글' })).toHaveLength(2);
  });

  // T-WEB-015 AC2: 표시 이름은 authorName 을 우선 사용한다
  it('authorName 을 작성자 이름으로 표시한다', () => {
    renderTree([
      makeComment({ id: 'm0', userId: 'u1', authorName: '박기순', body: '회원 댓글' }),
    ]);
    expect(screen.getByText('박기순')).toBeInTheDocument();
  });

  it('authorName 이 있으면 displayName 대신 authorName 을 표시한다', () => {
    renderTree([
      makeComment({
        id: 'm1',
        userId: 'u1',
        authorName: '실명사용자',
        displayName: '익명입력',
        body: '우선순위 댓글',
      }),
    ]);
    expect(screen.getByText('실명사용자')).toBeInTheDocument();
    expect(screen.queryByText('익명입력')).not.toBeInTheDocument();
  });

  // T-WEB-401: 권한별 수정·삭제 버튼
  it('본인 댓글이면 수정·삭제 버튼을 노출한다', () => {
    setUser({ id: 'u1', role: 'MEMBER', name: '나' });
    renderTree([
      makeComment({ id: 'c', userId: 'u1', authorName: '나', body: '내 댓글' }),
    ]);
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('타인 댓글에는 수정·삭제 버튼이 없다', () => {
    setUser({ id: 'other', role: 'MEMBER', name: 'o' });
    renderTree([
      makeComment({ id: 'c', userId: 'u1', authorName: '남', body: '남 댓글' }),
    ]);
    expect(
      screen.queryByRole('button', { name: '수정' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '삭제' }),
    ).not.toBeInTheDocument();
  });

  it('글쓴이(postAuthorId)는 타인 댓글의 삭제 버튼만 노출한다(수정 불가)', () => {
    setUser({ id: 'author', role: 'AUTHOR', name: 'a' });
    renderTree(
      [
        makeComment({
          id: 'c',
          userId: 'reader',
          authorName: '독자',
          body: '독자 댓글',
        }),
      ],
      'author',
    );
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '수정' }),
    ).not.toBeInTheDocument();
  });

  it('isDeleted 댓글은 "삭제된 댓글입니다" placeholder + 답글 보존', () => {
    renderTree([
      makeComment({
        id: 'c',
        isDeleted: true,
        replies: [
          makeComment({
            id: 'r',
            parentId: 'c',
            depth: 1,
            body: '살아있는 답글',
          }),
        ],
      }),
    ]);
    expect(screen.getByText('삭제된 댓글입니다')).toBeInTheDocument();
    expect(screen.getByText('살아있는 답글')).toBeInTheDocument();
  });

  it('isEdited 댓글은 "수정됨" 을 표시한다', () => {
    renderTree([makeComment({ id: 'c', isEdited: true, body: '수정된 본문' })]);
    expect(screen.getByText(/수정됨/)).toBeInTheDocument();
  });
});
