import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

// 하단 푸터
export function Footer() {
  return (
    <footer className="ab-footer">
      <div className="ab-footer-inner">
        <div className="ab-footer-brand">
          <span className="ab-brand-dot" /> {SITE.title}
          <p>{SITE.tagline}</p>
        </div>
        <nav className="ab-footer-nav">
          <Link to="/">글</Link>
          <Link to="/login">운영자</Link>
        </nav>
      </div>
      <p className="ab-footer-copy">
        © 2026 {SITE.title}. 모든 글의 저작권은 작성자에게 있습니다.
      </p>
    </footer>
  );
}
