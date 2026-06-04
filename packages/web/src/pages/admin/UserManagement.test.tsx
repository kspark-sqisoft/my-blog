import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}));

import { AxiosError } from 'axios';
import { api } from '../../lib/api';
import { UserManagement } from './UserManagement';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

const usersList = {
  data: {
    items: [
      {
        id: 'u1',
        email: 'admin@x.com',
        name: '관리자',
        role: 'ADMIN',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'u2',
        email: 'member@x.com',
        name: '회원',
        role: 'MEMBER',
        createdAt: '2026-06-02T00:00:00.000Z',
      },
    ],
    page: 1,
    pageSize: 50,
    total: 2,
  },
};

function renderUM() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <UserManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

describe('운영자 사용자 관리(UserManagement)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue(usersList);
    mockedApi.patch.mockResolvedValue({ data: usersList.data.items[1] });
  });

  it('사용자 목록(이름·이메일·역할)을 보여준다', async () => {
    renderUM();
    expect(await screen.findByText('관리자')).toBeInTheDocument();
    expect(screen.getByText('member@x.com')).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, pageSize: 50 },
    });
  });

  it('역할 셀렉트 변경 시 PATCH /admin/users/:id/role 을 호출한다', async () => {
    renderUM();
    await screen.findByText('회원');
    fireEvent.change(screen.getByLabelText('회원 역할 변경'), {
      target: { value: 'AUTHOR' },
    });
    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith('/admin/users/u2/role', {
        role: 'AUTHOR',
      }),
    );
  });

  it('마지막 ADMIN 강등(409) 시 에러 메시지를 보여준다', async () => {
    mockedApi.patch.mockRejectedValueOnce(axios409());
    renderUM();
    await screen.findByText('관리자');
    fireEvent.change(screen.getByLabelText('관리자 역할 변경'), {
      target: { value: 'MEMBER' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('마지막');
  });
});
