import { useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { PostListView } from '../components/PostListView';
import { SITE } from '../lib/site';
import { usePosts } from '../posts/usePosts';

const PAGE_SIZE = 10;

export function PostList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const query = usePosts({ page, pageSize: PAGE_SIZE });

  return (
    <div className="ab-page">
      <section className="ab-masthead">
        <h1 className="ab-masthead-title">{SITE.title}</h1>
        <p className="ab-masthead-sub">{SITE.tagline}</p>
      </section>

      <div className="ab-section-head">
        <h2>최근 글</h2>
      </div>

      <PostListView query={query} />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data?.total ?? 0}
        onChange={(next) => setSearchParams({ page: String(next) })}
      />
    </div>
  );
}
