import type { UserRole } from '@blog/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { useAuth } from './useAuth';
import { RoleRoute } from './RoleRoute';

function setUser(role: UserRole) {
  useAuth.setState({
    status: 'authenticated',
    user: { id: 'u1', email: 'a@b.c', name: '사용자', role, avatarUrl: null },
    error: null,
  });
}

function renderRole(roles: UserRole[]) {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RoleRoute roles={roles}>
              <div>ADMIN AREA</div>
            </RoleRoute>
          }
        />
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleRoute', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: 'idle', error: null });
    vi.clearAllMocks();
  });

  it('허용 역할(AUTHOR)이면 children 을 렌더한다', async () => {
    setUser('AUTHOR');
    renderRole(['AUTHOR', 'ADMIN']);
    expect(await screen.findByText('ADMIN AREA')).toBeInTheDocument();
  });

  it('허용 역할(ADMIN)이면 children 을 렌더한다', async () => {
    setUser('ADMIN');
    renderRole(['ADMIN']);
    expect(await screen.findByText('ADMIN AREA')).toBeInTheDocument();
  });

  it('MEMBER 는 허용되지 않아 홈(/)으로 리다이렉트한다', async () => {
    setUser('MEMBER');
    renderRole(['AUTHOR', 'ADMIN']);
    expect(await screen.findByText('HOME')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN AREA')).toBeNull();
  });

  it('AUTHOR 는 ADMIN 전용 라우트에서 홈(/)으로 리다이렉트한다', async () => {
    setUser('AUTHOR');
    renderRole(['ADMIN']);
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });

  it('미인증이면 /login 으로 리다이렉트한다', async () => {
    useAuth.setState({ status: 'unauthenticated', user: null });
    renderRole(['AUTHOR', 'ADMIN']);
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
  });
});
