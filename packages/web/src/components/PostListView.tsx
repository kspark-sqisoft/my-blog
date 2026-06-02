import type { Paginated, PostSummaryDto } from '@blog/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

// 목록 쿼리 결과를 로딩/에러/빈/정상 상태로 렌더한다 (acceptance #3)
export function PostListView({
  query,
}: {
  query: UseQueryResult<Paginated<PostSummaryDto>>;
}) {
  if (query.isPending) {
    return (
      <p role="status" className="p-8 text-center text-gray-500">
        불러오는 중…
      </p>
    );
  }
  if (query.isError) {
    return (
      <p role="alert" className="p-8 text-center text-red-600">
        목록을 불러오지 못했습니다.
      </p>
    );
  }

  const { items } = query.data;
  if (items.length === 0) {
    return (
      <p className="p-8 text-center text-gray-500">아직 글이 없습니다.</p>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((post) => (
        <li key={post.id} className="py-4">
          <Link
            to={`/posts/${post.id}`}
            className="text-xl font-semibold text-violet-700 hover:underline"
          >
            {post.title}
          </Link>
          {post.summary && (
            <p className="mt-1 text-sm text-gray-600">{post.summary}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                to={`/tags/${tag}`}
                className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
