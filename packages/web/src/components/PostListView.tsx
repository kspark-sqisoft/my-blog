import type { Paginated, PostSummaryDto } from '@blog/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fmtDate } from '../lib/format';
import { Avatar } from './Avatar';
import { PostCardCover } from './PostCardCover';

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
          {post.coverImageUrl && (
            <PostCardCover coverImageUrl={post.coverImageUrl} />
          )}
          <div className="ab-card-body">
            <Link to={`/posts/${post.slug}`} className="ab-card-link">
              <h2 className="ab-card-title">{post.title}</h2>
            </Link>
            {post.summary && <p className="ab-card-sum">{post.summary}</p>}
            <div className="ab-meta">
              <span className="inline-flex items-center gap-1.5">
                <Avatar
                  src={post.authorAvatarUrl}
                  name={post.authorName}
                  size="sm"
                />
                {post.authorName}
              </span>
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
