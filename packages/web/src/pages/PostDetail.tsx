import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArticleToc } from '../components/ArticleToc';
import { Avatar } from '../components/Avatar';
import { CommentSection } from '../components/CommentSection';
import { Icon } from '../components/Icon';
import { LikeButton } from '../components/LikeButton';
import { ReadingArticle } from '../components/ReadingArticle';
import { RelatedPosts } from '../components/RelatedPosts';
import type { TocItem } from '../lib/article-enhance';
import { fmtDate } from '../lib/format';
import { estimateReadingTime } from '../lib/reading-time';
import { usePost } from '../posts/usePost';
import { useRecordView } from '../posts/useEngagement';

export function PostDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const query = usePost(slug);

  // T-READ-103: 본문 보강 시 추출한 목차. 비면 사이드바를 숨기고 본문을 풀폭으로 둔다.
  const [toc, setToc] = useState<TocItem[]>([]);

  // T-READ-101: 읽는 시간(분). 본문에서 렌더타임 계산(ADR-0023). 0 이면 표시 숨김.
  const readingMinutes = useMemo(
    () =>
      estimateReadingTime(
        query.data?.contentHtml || query.data?.contentMarkdown || '',
      ),
    [query.data],
  );

  // ADR-0022: cuid 등 canonical 슬러그가 아닌 경로로 들어오면 슬러그 URL 로 정리(replace).
  useEffect(() => {
    const canonical = query.data?.slug;
    if (canonical && canonical !== slug) {
      navigate(`/posts/${canonical}`, { replace: true });
    }
  }, [query.data, slug, navigate]);

  // ADR-0024: 글을 연 시점에 조회 1회 핑(서버가 30분 dedup). 글당 한 번만 발사.
  const recordView = useRecordView();
  const viewedId = useRef<string | null>(null);
  const postId = query.data?.id;
  useEffect(() => {
    if (postId && viewedId.current !== postId) {
      viewedId.current = postId;
      recordView.mutate(postId);
    }
  }, [postId, recordView]);

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
  const hasToc = toc.length > 0;
  return (
    <div className={`ab-page ab-reading${hasToc ? ' ab-reading--with-toc' : ''}`}>
      <Link to="/" className="ab-back">
        <Icon name="back" size={16} /> 글 목록
      </Link>
      <div className="ab-reading-main">
        {/* aside 를 항상 렌더해 본문 컬럼의 위치를 고정한다(목차 등장으로 컬럼이 리마운트되는 것 방지).
            목차가 없으면 ArticleToc 는 null 을 반환해 빈 aside 가 되고, CSS :empty 로 숨겨진다. */}
        <aside className="ab-toc-aside">
          <ArticleToc items={toc} />
        </aside>
        <div className="ab-reading-col">
          <article>
            <header className="ab-article-head">
              <h1 className="ab-article-title">{post.title}</h1>
              <div className="ab-meta">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar
                    src={post.authorAvatarUrl}
                    name={post.authorName}
                    size="sm"
                  />
                  {post.authorName}
                </span>
                <span className="ab-dot">·</span>
                <span>{fmtDate(post.publishedAt)}</span>
                {readingMinutes > 0 && (
                  <>
                    <span className="ab-dot">·</span>
                    <span className="ab-meta-read">{readingMinutes}분 읽기</span>
                  </>
                )}
                <span className="ab-dot">·</span>
                <span
                  className="inline-flex items-center gap-1"
                  aria-label="조회수"
                >
                  <Icon name="eye" size={15} /> {post.viewCount}
                </span>
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
              {/* ADR-0021/0023: contentHtml 우선(과도기 contentMarkdown 폴백), 읽기용 보강 렌더 */}
              <ReadingArticle
                html={post.contentHtml || post.contentMarkdown}
                onToc={setToc}
              />
            </div>
          </article>
          {/* ADR-0024: 좋아요(참여) */}
          <div className="mt-8 flex justify-center">
            <LikeButton post={post} />
          </div>
          <RelatedPosts idOrSlug={post.slug} />
          <CommentSection postId={post.id} />
        </div>
      </div>
    </div>
  );
}
