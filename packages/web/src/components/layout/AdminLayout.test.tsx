import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import type { UserRole } from '@blog/shared';
import { useAuth } from '../../auth/useAuth';
import { AdminLayout } from './AdminLayout';

function setRole(role: UserRole) {
  useAuth.setState({
    status: 'authenticated',
    user: { id: 'u1', email: 'a@b.c', name: '운영자', role, avatarUrl: null, bio: null },
    error: null,
  });
}

function renderLayout() {
  return render(
    <MemoryRouter>
      <AdminLayout />
    </MemoryRouter>,
  );
}

describe('AdminLayout 사이드바', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: 'idle', error: null });
    vi.clearAllMocks();
  });

  it('ADMIN 은 사용자 관리(/admin/users) 링크를 본다', () => {
    setRole('ADMIN');
    renderLayout();
    expect(
      screen.getByRole('link', { name: /사용자 관리/ }),
    ).toHaveAttribute('href', '/admin/users');
  });

  it('AUTHOR 는 사용자 관리 링크를 보지 못한다', () => {
    setRole('AUTHOR');
    renderLayout();
    expect(screen.queryByRole('link', { name: /사용자 관리/ })).toBeNull();
  });
});
