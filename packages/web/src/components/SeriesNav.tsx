import type { SeriesNavDto } from '@blog/shared';
import { Link } from 'react-router-dom';

// 글 상세의 시리즈 네비게이션 (ADR-0029). 현재 글이 속한 시리즈와 위치(N/M편),
// 이전/다음 발행글 링크를 보여준다. 발행글만 대상(서버가 파생).
export function SeriesNav({ series }: { series: SeriesNavDto }) {
  return (
    <nav className="ab-series-nav" aria-label="시리즈 네비게이션">
      <div className="ab-series-nav-head">
        <Link to={`/series/${series.slug}`} className="ab-text-link">
          {series.title}
        </Link>
        <span className="ab-dot">·</span>
        <span className="ab-series-nav-pos">
          {series.position}/{series.total}편
        </span>
      </div>
      <div className="ab-series-nav-links">
        {series.prev && (
          <Link
            to={`/posts/${series.prev.slug}`}
            className="ab-series-nav-prev ab-text-link"
          >
            ← 이전 글: {series.prev.title}
          </Link>
        )}
        {series.next && (
          <Link
            to={`/posts/${series.next.slug}`}
            className="ab-series-nav-next ab-text-link"
          >
            다음 글: {series.next.title} →
          </Link>
        )}
      </div>
    </nav>
  );
}
