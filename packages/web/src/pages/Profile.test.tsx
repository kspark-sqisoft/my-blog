import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import { Profile } from './Profile';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Profile 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'me@x.com',
        name: '기존이름',
        role: 'MEMBER',
        avatarUrl: null,
        bio: null,
      },
      error: null,
    });
  });

  it('이메일은 읽기전용으로 표시한다', () => {
    renderProfile();
    const email = screen.getByLabelText('이메일') as HTMLInputElement;
    expect(email.value).toBe('me@x.com');
    expect(email).toBeDisabled();
  });

  it('이름을 바꾸고 저장하면 PATCH /auth/me 를 호출하고 스토어를 갱신한다', async () => {
    mockedApi.patch.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'me@x.com',
          name: '새이름',
          role: 'MEMBER',
          avatarUrl: null,
          bio: null,
        },
      },
    });
    renderProfile();
    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '새이름' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith('/auth/me', {
        name: '새이름',
        avatarUrl: null,
        bio: '',
      }),
    );
    expect(useAuth.getState().user?.name).toBe('새이름');
  });

  // T-WEB-403: 소개(bio) 편집
  it('현재 bio 를 textarea 에 로드한다', () => {
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'me@x.com',
        name: '기존이름',
        role: 'MEMBER',
        avatarUrl: null,
        bio: '내 소개글입니다',
      },
      error: null,
    });
    renderProfile();
    expect((screen.getByLabelText('소개') as HTMLTextAreaElement).value).toBe(
      '내 소개글입니다',
    );
  });

  it('bio 를 입력하고 저장하면 PATCH 에 bio 가 포함된다', async () => {
    mockedApi.patch.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'me@x.com',
          name: '기존이름',
          role: 'MEMBER',
          avatarUrl: null,
          bio: '새 소개',
        },
      },
    });
    renderProfile();
    fireEvent.change(screen.getByLabelText('소개'), {
      target: { value: '새 소개' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith('/auth/me', {
        name: '기존이름',
        avatarUrl: null,
        bio: '새 소개',
      }),
    );
    expect(useAuth.getState().user?.bio).toBe('새 소개');
  });

  it('기존 bio 를 비우고 저장하면 bio:"" 를 전송한다(소개 제거)', async () => {
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'me@x.com',
        name: '기존이름',
        role: 'MEMBER',
        avatarUrl: null,
        bio: '지울 소개',
      },
      error: null,
    });
    mockedApi.patch.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'me@x.com',
          name: '기존이름',
          role: 'MEMBER',
          avatarUrl: null,
          bio: '',
        },
      },
    });
    renderProfile();
    fireEvent.change(screen.getByLabelText('소개'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith('/auth/me', {
        name: '기존이름',
        avatarUrl: null,
        bio: '',
      }),
    );
  });

  it('bio 가 200자를 넘으면 에러를 표시하고 저장하지 않는다', async () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText('소개'), {
      target: { value: 'a'.repeat(201) },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText(/200자 이하/)).toBeInTheDocument();
    expect(mockedApi.patch).not.toHaveBeenCalled();
  });

  it('200자 제한을 클라이언트에 표시한다', () => {
    renderProfile();
    expect(screen.getByText(/\/200/)).toBeInTheDocument();
  });

  it('아바타 파일 선택 시 업로드하고 미리보기에 반영한다', async () => {
    mockedApi.post.mockResolvedValue({ data: { url: '/uploads/new.png' } });
    renderProfile();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('아바타 이미지 선택'), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/profile/avatar',
        expect.any(FormData),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        '/uploads/new.png',
      ),
    );
  });
});
