import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { PostListView } from '../components/PostListView';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SITE } from '../lib/site';
import { usePosts } from '../posts/usePosts';

const PAGE_SIZE = 10;

export function PostList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1') || 1;

  // 검색 입력(소스) → 디바운스 → URL(?q=)·쿼리에 반영. 비우면 전체.
  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const debounced = useDebouncedValue(term.trim(), 300);

  // 디바운스된 검색어가 "실제로 바뀔 때만" URL 반영(+1페이지 리셋).
  // searchParams/setSearchParams 를 deps 에 넣으면 매 렌더 churn 으로 입력이 막히므로,
  // 마지막 적용값은 ref 로 비교하고 deps 는 debounced 만 둔다(함수형 업데이트로 최신 상태 반영).
  const appliedQ = useRef(searchParams.get('q') ?? '');
  useEffect(() => {
    if (debounced === appliedQ.current) return;
    appliedQ.current = debounced;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debounced) next.set('q', debounced);
        else next.delete('q');
        next.delete('page'); // 검색 변경 시 1페이지로
        return next;
      },
      { replace: true },
    );
    // setSearchParams 는 의도적으로 deps 제외(매 렌더 churn 방지) — eslint-disable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = usePosts({
    page,
    pageSize: PAGE_SIZE,
    q: debounced || undefined,
  });

  return (
    <div className="ab-page">
      <section className="ab-masthead">
        <h1 className="ab-masthead-title">{SITE.title}</h1>
        <p className="ab-masthead-sub">{SITE.tagline}</p>
      </section>

      <div className="ab-section-head">
        <h2>최근 글</h2>
        <input
          type="search"
          className="ab-search"
          placeholder="제목·본문 검색"
          aria-label="글 검색"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <PostListView query={query} />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data?.total ?? 0}
        onChange={(next) =>
          setSearchParams({
            page: String(next),
            ...(debounced ? { q: debounced } : {}),
          })
        }
      />
    </div>
  );
}
