import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { SITE } from '../../lib/site';
import { Icon } from '../Icon';

// 운영자 콘솔 공통 셸: 사이드바(시스템 UI) + 본문 Outlet
export function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="ab-admin">
      <aside className="ab-side">
        <Link to="/" className="ab-side-brand">
          <span className="ab-brand-dot" /> {SITE.title}
        </Link>
        <nav className="ab-side-nav">
          <NavLink to="/admin" end>
            <Icon name="grid" size={17} /> 글 관리
          </NavLink>
          <NavLink to="/admin/posts/new">
            <Icon name="plus" size={17} /> 새 글 작성
          </NavLink>
          {/* 시리즈 관리(series, ADR-0029) — AUTHOR/ADMIN 본인 시리즈 진입. T-WEB-504 후속(acceptance 갭). */}
          <NavLink to="/admin/series">
            <Icon name="grid" size={17} /> 시리즈 관리
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin/users">
              <Icon name="user" size={17} /> 사용자 관리
            </NavLink>
          )}
          <Link to="/">
            <Icon name="eye" size={17} /> 사이트 보기
          </Link>
        </nav>
        <div className="ab-side-foot">
          <div className="ab-side-user">
            <span className="ab-avatar sm">
              <Icon name="user" size={15} />
            </span>
            <span className="ab-side-email">{user?.email ?? '운영자'}</span>
          </div>
          <button
            type="button"
            className="ab-side-logout"
            onClick={handleLogout}
          >
            <Icon name="logout" size={16} /> 로그아웃
          </button>
        </div>
      </aside>

      <div className="ab-admin-main">
        <Outlet />
      </div>
    </div>
  );
}
