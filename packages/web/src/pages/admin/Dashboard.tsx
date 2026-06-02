import { Link } from 'react-router-dom';
import { useAdminPostActions, useAdminPosts } from '../../admin/useAdminPosts';

export function Dashboard() {
  const query = useAdminPosts();
  const { publish, unpublish, remove } = useAdminPostActions();

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

  return (
    <main className="mx-auto max-w-3xl p-6 text-left">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">운영자 대시보드</h1>
        <Link
          to="/admin/posts/new"
          className="rounded bg-violet-600 px-3 py-2 text-sm text-white"
        >
          새 글 작성
        </Link>
      </div>

      <ul className="divide-y">
        {query.data.items.map((post) => (
          <li
            key={post.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{post.title}</p>
              <span
                className={`text-xs ${
                  post.status === 'PUBLISHED'
                    ? 'text-green-600'
                    : 'text-gray-500'
                }`}
              >
                {post.status === 'PUBLISHED' ? '발행됨' : '초안'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm">
              <Link
                to={`/admin/posts/${post.id}/edit`}
                className="rounded border px-2 py-1"
              >
                수정
              </Link>
              {post.status === 'DRAFT' ? (
                <button
                  type="button"
                  onClick={() => publish.mutate(post.id)}
                  className="rounded border px-2 py-1 text-violet-700"
                >
                  발행
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => unpublish.mutate(post.id)}
                  className="rounded border px-2 py-1"
                >
                  발행취소
                </button>
              )}
              <button
                type="button"
                onClick={() => remove.mutate(post.id)}
                className="rounded border px-2 py-1 text-red-600"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
