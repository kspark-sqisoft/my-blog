import { useParams, useSearchParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Pagination } from '../components/Pagination';
import { PostListView } from '../components/PostListView';
import { fmtDate } from '../lib/format';
import { usePosts } from '../posts/usePosts';
import { useAuthorProfile } from '../profile/useAuthorProfile';

const PAGE_SIZE = 20;

// 공개 작성자 프로필 페이지 (/users/:id) — 헤더(아바타·이름·소개·가입일·발행글 수) + 발행글 목록.
// 데이터는 useAuthorProfile(프로필) + usePosts({ author })(목록) 훅 경유 (ADR-0028, 직접 fetch 금지).
export function AuthorProfile() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const profileQuery = useAuthorProfile(id);
  const postsQuery = usePosts({ page, pageSize: PAGE_SIZE, author: id });

  if (profileQuery.isPending) {
    return (
      <p role="status" className="ab-state">
        불러오는 중…
      </p>
    );
  }
  if (profileQuery.isError) {
    return (
      <p role="alert" className="ab-state error">
        작성자를 찾을 수 없습니다.
      </p>
    );
  }

  const author = profileQuery.data;

  return (
    <div className="ab-page">
      <section className="ab-masthead small">
        <Avatar src={author.avatarUrl} name={author.name} size="lg" />
        <h1 className="ab-masthead-title">{author.name}</h1>
        {author.bio && <p className="ab-card-sum">{author.bio}</p>}
        <div className="ab-meta">
          <span>가입일 {fmtDate(author.createdAt)}</span>
          <span className="ab-dot">·</span>
          <span>발행한 글 {author.postCount}개</span>
        </div>
      </section>
      <PostListView query={postsQuery} emptyText="아직 발행한 글이 없습니다." />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={postsQuery.data?.total ?? 0}
        onChange={(next) => setSearchParams({ page: String(next) })}
      />
    </div>
  );
}
