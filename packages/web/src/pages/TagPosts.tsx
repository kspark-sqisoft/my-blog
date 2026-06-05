import { useParams, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { PostListView } from '../components/PostListView';
import { usePosts } from '../posts/usePosts';

const PAGE_SIZE = 20;

export function TagPosts() {
  const { name = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const query = usePosts({ page, pageSize: PAGE_SIZE, tag: name });

  return (
    <div className="ab-page">
      <section className="ab-masthead small">
        <span className="ab-eyebrow">태그</span>
        <h1 className="ab-masthead-title">#{name}</h1>
      </section>
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
