import type { Paginated, PostSummaryDto } from '@blog/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fmtDate } from '../lib/format';

// 비디오로 분기할 URL 확장자(ADR-0020). Markdown.tsx 의 VIDEO_EXTENSIONS 와 한 쌍.
const VIDEO_COVER_EXT = /\.mp4(?:\?|#|$)/i;

// 목록 쿼리 결과를 로딩/에러/빈/정상 상태로 렌더한다 (acceptance #3)
export function PostListView({
  query,
}: {
  query: UseQueryResult<Paginated<PostSummaryDto>>;
}) {
  if (query.isPending) {
    return (
      <p role="status" className="ab-state">
        불러오는 중…
      </p>
    );
  }
  if (query.isError) {
    return (
      <p role="alert" className="ab-state error">
        목록을 불러오지 못했습니다.
      </p>
    );
  }

  const { items } = query.data;
  if (items.length === 0) {
    return <p className="ab-empty">아직 글이 없습니다.</p>;
  }

  return (
    <ul className="ab-grid">
      {items.map((post) => (
        <li key={post.id} className="ab-card">
          <Link to={`/posts/${post.slug}`} className="ab-card-cover-link">
            {post.coverImageUrl ? (
              VIDEO_COVER_EXT.test(post.coverImageUrl) ? (
                // 비디오 커버: 첫 프레임만 표시. controls 없음 → 카드 클릭은 상세 이동만.
                <video
                  className="ab-card-cover"
                  src={post.coverImageUrl}
                  preload="metadata"
                  muted
                  playsInline
                />
              ) : (
                <img
                  className="ab-card-cover"
                  src={post.coverImageUrl}
                  alt=""
                  loading="lazy"
                />
              )
            ) : (
              <div className="ab-ph ab-card-cover" />
            )}
          </Link>
          <div className="ab-card-body">
            <Link to={`/posts/${post.slug}`}>
              <h2 className="ab-card-title">{post.title}</h2>
            </Link>
            {post.summary && <p className="ab-card-sum">{post.summary}</p>}
            <div className="ab-meta">
              <span>{post.authorName}</span>
              <span>{fmtDate(post.publishedAt)}</span>
            </div>
            {post.tags.length > 0 && (
              <div className="ab-tags">
                {post.tags.map((tag) => (
                  <Link key={tag} to={`/tags/${tag}`} className="ab-tag">
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
