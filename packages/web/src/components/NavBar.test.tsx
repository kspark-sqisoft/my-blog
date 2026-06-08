import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
        bio: null,
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
        bio: null,
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

  // 로그아웃 발견성 보강: 그동안 /admin 사이드바에만 있어서 공개 페이지에서 닿을 길이 없었다.
  // NavBar 우측, 프로필/대시보드 옆에 항상 노출한다(아이콘 버튼, aria-label="로그아웃").
  it('인증 상태면 로그아웃 버튼을 보여준다', () => {
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'me@x.com',
        name: '나',
        role: 'MEMBER',
        avatarUrl: null,
        bio: null,
      },
    });
    renderNav();
    expect(
      screen.getByRole('button', { name: '로그아웃' }),
    ).toBeInTheDocument();
  });

  it('비인증 상태면 로그아웃 버튼은 없다', () => {
    useAuth.setState({ status: 'unauthenticated' });
    renderNav();
    expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull();
  });

  it('로그아웃 버튼을 클릭하면 logout() 을 호출한다', () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    useAuth.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'me@x.com',
        name: '나',
        role: 'MEMBER',
        avatarUrl: null,
        bio: null,
      },
      logout,
    });
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
