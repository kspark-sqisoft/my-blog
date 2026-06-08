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

  // 회귀: T-WEB-504 acceptance 갭 — 페이지(/admin/series)는 만들었지만 사이드바 진입 누락.
  // AUTHOR·ADMIN 모두 본인 시리즈를 관리할 수 있어야 하므로 두 역할 다 노출한다.
  it('AUTHOR 는 시리즈 관리(/admin/series) 링크를 본다', () => {
    setRole('AUTHOR');
    renderLayout();
    expect(
      screen.getByRole('link', { name: /시리즈 관리/ }),
    ).toHaveAttribute('href', '/admin/series');
  });

  it('ADMIN 도 시리즈 관리(/admin/series) 링크를 본다', () => {
    setRole('ADMIN');
    renderLayout();
    expect(
      screen.getByRole('link', { name: /시리즈 관리/ }),
    ).toHaveAttribute('href', '/admin/series');
  });
});
