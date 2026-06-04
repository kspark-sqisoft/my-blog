import { Link, useParams } from 'react-router-dom';
import { CommentSection } from '../components/CommentSection';
import { Icon } from '../components/Icon';
import { RichContent } from '../components/RichContent';
import { fmtDate } from '../lib/format';
import { usePost } from '../posts/usePost';

export function PostDetail() {
  const { id = '' } = useParams();
  const query = usePost(id);

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
        글을 불러오지 못했습니다.
      </p>
    );
  }

  const post = query.data;
  return (
    <div className="ab-page ab-reading">
      <Link to="/" className="ab-back">
        <Icon name="back" size={16} /> 글 목록
      </Link>
      <article>
        <header className="ab-article-head">
          <h1 className="ab-article-title">{post.title}</h1>
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
        </header>
        <div className="ab-article-body">
          {/* ADR-0021: contentHtml 우선, 과도기 contentMarkdown 폴백 */}
          <RichContent html={post.contentHtml || post.contentMarkdown} />
        </div>
      </article>
      <CommentSection postId={post.id} />
    </div>
  );
}
