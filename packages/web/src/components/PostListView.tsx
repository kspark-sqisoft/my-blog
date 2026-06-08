import type { Paginated, PostSummaryDto } from '@blog/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fmtDate } from '../lib/format';
import { Avatar } from './Avatar';
import { PostCardCover } from './PostCardCover';

// 발행글 목록을 카드 그리드로 렌더한다.
// - query 모드: 쿼리 결과를 로딩/에러/빈/정상 상태로 렌더 (홈·태그·작성자 프로필).
// - items 모드: 이미 적재된 배열을 직접 렌더 (시리즈 상세처럼 부모가 로딩/에러 처리 — T-WEB-501).
// emptyText: 빈 목록 안내 문구(기본 "아직 글이 없습니다.").
export function PostListView({
  query,
  items: itemsProp,
  emptyText = '아직 글이 없습니다.',
}: {
  query?: UseQueryResult<Paginated<PostSummaryDto>>;
  items?: PostSummaryDto[];
  emptyText?: string;
}) {
  if (query) {
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
  }

  const items = query ? query.data.items : (itemsProp ?? []);
  if (items.length === 0) {
    return <p className="ab-empty">{emptyText}</p>;
  }

  return (
    <ul className="ab-grid">
      {items.map((post) => (
        <li key={post.id} className="ab-card">
          {post.coverImageUrl && (
            <PostCardCover coverImageUrl={post.coverImageUrl} />
          )}
          <div className="ab-card-body">
            {/* 시리즈 소속이면 카드 최상단에 배지 노출(ADR-0029). 클릭하면 시리즈 상세로. */}
            {post.series && (
              <Link
                to={`/series/${post.series.slug}`}
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
                aria-label={`시리즈 ${post.series.title}, ${post.series.order}편째`}
              >
                <span>{post.series.title}</span>
                <span aria-hidden>·</span>
                <span>{post.series.order}편째</span>
              </Link>
            )}
            <Link to={`/posts/${post.slug}`} className="ab-card-link">
              <h2 className="ab-card-title">{post.title}</h2>
            </Link>
            {post.summary && <p className="ab-card-sum">{post.summary}</p>}
            <div className="ab-meta">
              <span className="inline-flex items-center gap-1.5">
                <Avatar
                  src={post.authorAvatarUrl}
                  name={post.authorName}
                  size="xs"
                />
                <Link to={`/users/${post.authorId}`} className="ab-text-link">
                  {post.authorName}
                </Link>
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
