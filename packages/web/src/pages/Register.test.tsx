import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import { Register } from './Register';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function renderRegister() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<div>HOME PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillAndSubmit(email: string, password: string, name: string) {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
}

function axios409() {
  return new AxiosError('conflict', 'ERR', undefined, undefined, {
    status: 409,
    data: {},
    statusText: 'Conflict',
    headers: {},
    config: {} as never,
  });
}

describe('Register 페이지', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: 'idle', error: null });
    vi.clearAllMocks();
  });

  it('성공 가입 시 POST /auth/register 호출 후 홈(/)으로 이동한다', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'new@example.com', name: '새회원', role: 'AUTHOR' } },
    });
    renderRegister();
    fillAndSubmit('new@example.com', 'secret123', '새회원');

    expect(await screen.findByText('HOME PAGE')).toBeInTheDocument();
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      password: 'secret123',
      name: '새회원',
    });
    expect(useAuth.getState().status).toBe('authenticated');
  });

  it('중복 이메일(409)이면 에러 메시지를 보여준다', async () => {
    mockedApi.post.mockRejectedValueOnce(axios409());
    renderRegister();
    fillAndSubmit('dup@example.com', 'secret123', '중복');

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 사용 중인 이메일');
  });

  it('비밀번호가 8자 미만이면 클라이언트 검증 에러를 보여주고 호출하지 않는다', async () => {
    renderRegister();
    fillAndSubmit('short@example.com', '123', '짧음');

    expect(await screen.findByText(/8자 이상/)).toBeInTheDocument();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
