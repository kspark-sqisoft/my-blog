import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { SITE } from '../lib/site';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';

// 상단 frosted 네비게이션 바 (테마 토글 + 운영자 진입)
export function NavBar() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const status = useAuth((s) => s.status);
  const authed = status === 'authenticated';

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
            <Link to="/admin" className="ab-pill-btn">
              <Icon name="grid" size={15} /> 대시보드
            </Link>
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
