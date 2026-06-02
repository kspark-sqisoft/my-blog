import { useParams, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { PostListView } from '../components/PostListView';
import { usePosts } from '../posts/usePosts';

const PAGE_SIZE = 10;

export function TagPosts() {
  const { name = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const query = usePosts({ page, pageSize: PAGE_SIZE, tag: name });

  return (
    <main className="mx-auto max-w-3xl p-6 text-left">
      <h1 className="mb-6 text-3xl font-semibold">#{name}</h1>
      <PostListView query={query} />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data?.total ?? 0}
        onChange={(next) => setSearchParams({ page: String(next) })}
      />
    </main>
  );
}
