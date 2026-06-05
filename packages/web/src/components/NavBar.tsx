import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { SITE } from '../lib/site';
import { useTheme } from '../theme/useTheme';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

// 상단 frosted 네비게이션 바 (테마 토글 + 로그인 사용자 아바타·이메일 + 운영자 진입)
export function NavBar() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const fetchMe = useAuth((s) => s.fetchMe);
  const authed = status === 'authenticated';
  const isOperator = user?.role === 'AUTHOR' || user?.role === 'ADMIN';

  // 공개 화면에서도 로그인 사용자를 네비에 표시하려면 세션을 1회 조회한다 (ADR-0025).
  useEffect(() => {
    if (status === 'idle') void fetchMe();
  }, [status, fetchMe]);

  return (
    <header className="ab-nav">
      <div className="ab-nav-inner">
        <Link to="/" className="ab-brand">
          <span className="ab-brand-dot" />
          {SITE.title}
        </Link>
        <nav className="ab-nav-links">
          <NavLink to="/" end>
            글
          </NavLink>
        </nav>
        <div className="ab-nav-right">
          <button
            type="button"
            className="ab-icon-btn"
            onClick={toggle}
            aria-label="테마 전환"
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          </button>
          {authed ? (
            <>
              {isOperator && (
                <Link to="/admin" className="ab-pill-btn">
                  <Icon name="grid" size={15} /> 대시보드
                </Link>
              )}
              {/* 로그인 사용자: 아바타 + 이메일 → 프로필 (ADR-0025) */}
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-full px-1 hover:opacity-80"
                aria-label="프로필"
              >
                <Avatar src={user?.avatarUrl} name={user?.name} size="sm" />
                <span className="max-w-[11rem] truncate text-sm">
                  {user?.email}
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="ab-pill-btn ghost">
                회원가입
              </Link>
              <Link to="/login" className="ab-pill-btn ghost">
                로그인
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
