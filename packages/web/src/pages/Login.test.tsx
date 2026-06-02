import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { Login } from './Login';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function renderLogin() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<div>ADMIN PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

describe('Login 페이지', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: 'idle', error: null });
    vi.clearAllMocks();
  });

  it('성공 로그인 시 POST /auth/login 호출 후 /admin 으로 이동한다', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'owner@example.com' } },
    });
    renderLogin();
    fillAndSubmit('owner@example.com', 'secret123');

    expect(await screen.findByText('ADMIN PAGE')).toBeInTheDocument();
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'owner@example.com',
      password: 'secret123',
    });
  });

  it('실패 로그인 시 에러 메시지를 보여준다', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('401'));
    renderLogin();
    fillAndSubmit('owner@example.com', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('올바르지 않습니다');
  });
});
