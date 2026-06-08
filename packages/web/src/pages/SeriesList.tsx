import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { useSeriesList } from '../series/useSeriesList';

const PAGE_SIZE = 20;

// 공개 시리즈 목록 페이지 (/series) — 시리즈 카드 그리드 + 페이지네이션 (ADR-0029).
// 데이터는 useSeriesList 훅 경유(직접 fetch 금지).
export function SeriesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const query = useSeriesList({ page, pageSize: PAGE_SIZE });

  return (
    <div className="ab-page">
      <section className="ab-masthead small">
        <span className="ab-eyebrow">연재</span>
        <h1 className="ab-masthead-title">시리즈</h1>
      </section>

      {query.isPending && (
        <p role="status" className="ab-state">
          불러오는 중…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="ab-state error">
          목록을 불러오지 못했습니다.
        </p>
      )}
      {query.data &&
        (query.data.items.length === 0 ? (
          <p className="ab-empty">아직 시리즈가 없습니다.</p>
        ) : (
          <>
            <ul className="ab-grid">
              {query.data.items.map((series) => (
                <li key={series.id} className="ab-card">
                  <div className="ab-card-body">
                    <Link
                      to={`/series/${series.slug}`}
                      className="ab-card-link"
                    >
                      <h2 className="ab-card-title">{series.title}</h2>
                    </Link>
                    {series.description && (
                      <p className="ab-card-sum">{series.description}</p>
                    )}
                    <div className="ab-meta">
                      <Link
                        to={`/users/${series.authorId}`}
                        className="ab-text-link"
                      >
                        {series.authorName}
                      </Link>
                      <span className="ab-dot">·</span>
                      <span>{series.postCount}편</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={query.data.total}
              onChange={(next) => setSearchParams({ page: String(next) })}
            />
          </>
        ))}
    </div>
  );
}
