import { Link } from 'react-router-dom';
import { fmtDate } from '../lib/format';
import { useRelatedPosts } from '../posts/useRelatedPosts';
import { PostCardCover } from './PostCardCover';

// T-READ-104: 글 하단 관련 글 섹션. 태그 겹침 우선(서버). 비거나 로딩/에러면 섹션 자체를 숨긴다.
export function RelatedPosts({ idOrSlug }: { idOrSlug: string }) {
  const query = useRelatedPosts(idOrSlug);
  const items = query.data ?? [];
  if (query.isPending || query.isError || items.length === 0) {
    return null;
  }

  return (
    <section className="ab-related" aria-label="관련 글">
      <h2 className="ab-related-title">관련 글</h2>
      <ul className="ab-grid ab-related-grid">
        {items.map((post) => (
          <li key={post.id} className="ab-card">
            <Link to={`/posts/${post.slug}`} className="ab-card-cover-link">
              <PostCardCover coverImageUrl={post.coverImageUrl} />
            </Link>
            <div className="ab-card-body">
              <Link to={`/posts/${post.slug}`}>
                <h3 className="ab-card-title">{post.title}</h3>
              </Link>
              <div className="ab-meta">
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
    </section>
  );
}
