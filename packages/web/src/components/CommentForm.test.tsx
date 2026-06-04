import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }));

import type { AuthUserDto } from '@blog/shared';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import { CommentForm } from './CommentForm';

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };
const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

// useAuth(selector) 형태를 흉내내어 지정한 user 로 상태를 주입한다.
function setAuthUser(user: AuthUserDto | null) {
  const status = user ? 'authenticated' : 'unauthenticated';
  mockedUseAuth.mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ user, status }),
  );
}

function renderForm(props: { postId?: string; parentId?: string } = {}) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CommentForm postId={props.postId ?? 'p1'} parentId={props.parentId} />
    </QueryClientProvider>,
  );
}

describe('CommentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthUser(null); // 기본: 비로그인
  });

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

  // T-WEB-015 AC1: 비로그인 시에는 이름(선택) 입력이 보인다
  it('비로그인 시 이름(선택) 입력을 보여준다', () => {
    renderForm();
    expect(screen.getByLabelText('이름(선택)')).toBeInTheDocument();
  });

  // T-WEB-015 AC1: 로그인 시 이름 입력을 숨기고 계정 이름을 표시한다
  it('로그인 시 이름 입력을 숨기고 계정 이름을 표시한다', () => {
    setAuthUser({
      id: 'u1',
      email: 'kim@x.com',
      name: '박기순',
      role: 'MEMBER',
    });
    renderForm();
    expect(screen.queryByLabelText('이름(선택)')).not.toBeInTheDocument();
    expect(screen.getByText('박기순')).toBeInTheDocument();
  });

  // T-WEB-015 AC1: 로그인 시 displayName 을 전송하지 않는다
  it('로그인 시 등록하면 displayName 없이 body 만 전송한다', async () => {
    setAuthUser({
      id: 'u1',
      email: 'kim@x.com',
      name: '박기순',
      role: 'MEMBER',
    });
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c3' } });
    renderForm();
    fireEvent.change(screen.getByLabelText('댓글 내용'), {
      target: { value: '실명 댓글' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts/p1/comments', {
        body: '실명 댓글',
      }),
    );
  });
});
