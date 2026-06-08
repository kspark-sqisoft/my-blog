import { Link, useParams } from 'react-router-dom';
import { PostListView } from '../components/PostListView';
import { useSeries } from '../series/useSeries';

// 공개 시리즈 상세 페이지 (/series/:slug) — 헤더(제목·설명·작성자 링크) + 순서대로 발행글 목록.
// 데이터는 useSeries 훅 경유(직접 fetch 금지). 발행글만 노출(ADR-0029).
export function SeriesDetail() {
  const { slug = '' } = useParams();
  const query = useSeries(slug);

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
        시리즈를 찾을 수 없습니다.
      </p>
    );
  }

  const series = query.data;

  return (
    <div className="ab-page">
      <section className="ab-masthead small">
        <span className="ab-eyebrow">시리즈</span>
        <h1 className="ab-masthead-title">{series.title}</h1>
        {series.description && (
          <p className="ab-card-sum">{series.description}</p>
        )}
        <div className="ab-meta">
          <Link to={`/users/${series.authorId}`} className="ab-text-link">
            {series.authorName}
          </Link>
          <span className="ab-dot">·</span>
          <span>{series.postCount}편</span>
        </div>
      </section>
      <PostListView
        items={series.posts}
        emptyText="아직 발행된 글이 없습니다."
      />
    </div>
  );
}
