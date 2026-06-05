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
      user: {
        id: 'u1',
        email: 'a@b.c',
        name: '운영자',
        role: 'ADMIN',
        avatarUrl: null,
      },
    });
    renderNav();
    expect(screen.queryByRole('link', { name: '회원가입' })).toBeNull();
  });

  // ADR-0025: 로그인 사용자의 이메일 + 프로필 링크
  it('로그인 시 이메일과 프로필 링크(/profile)를 보여준다', () => {
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'me@x.com',
        name: '나',
        role: 'MEMBER',
        avatarUrl: null,
      },
    });
    renderNav();
    expect(screen.getByText('me@x.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '프로필' })).toHaveAttribute(
      'href',
      '/profile',
    );
    // MEMBER 는 대시보드 링크 없음(운영자 전용)
    expect(screen.queryByRole('link', { name: /대시보드/ })).toBeNull();
  });
});
