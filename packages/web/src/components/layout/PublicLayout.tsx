import { Outlet } from 'react-router-dom';
import { Footer } from '../Footer';
import { NavBar } from '../NavBar';

// 공개 화면 공통 셸: frosted 네비 + 본문 + 푸터
export function PublicLayout() {
  return (
    <div className="ab-frame">
      <NavBar />
      <main className="ab-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
