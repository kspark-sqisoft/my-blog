import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuth } from '../auth/useAuth';
import { NavBar } from './NavBar';

function renderNav() {
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  );
}

describe('NavBar', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: 'idle', error: null });
  });

  it('비인증 상태면 회원가입 링크(/register)를 보여준다', () => {
    useAuth.setState({ status: 'unauthenticated' });
    renderNav();
    const link = screen.getByRole('link', { name: '회원가입' });
    expect(link).toHaveAttribute('href', '/register');
  });

  it('인증 상태면 회원가입 링크를 숨긴다', () => {
    useAuth.setState({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.c', name: '운영자', role: 'ADMIN' },
    });
    renderNav();
    expect(screen.queryByRole('link', { name: '회원가입' })).toBeNull();
  });
});
