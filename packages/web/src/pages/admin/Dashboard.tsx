import { Link } from 'react-router-dom';
import { useAdminPostActions, useAdminPosts } from '../../admin/useAdminPosts';
import { fmtDate } from '../../lib/format';

export function Dashboard() {
  const query = useAdminPosts();
  const { publish, unpublish, remove } = useAdminPostActions();

  const items = query.data?.items ?? [];
  const published = items.filter((p) => p.status === 'PUBLISHED').length;
  const drafts = items.length - published;

  return (
    <>
      <header className="ab-admin-bar">
        <h1>운영자 대시보드</h1>
      </header>
      <div className="ab-admin-body">
        {query.isPending ? (
          <p role="status" className="ab-state">
            불러오는 중…
          </p>
        ) : query.isError ? (
          <p role="alert" className="ab-state error">
            목록을 불러오지 못했습니다.
          </p>
        ) : (
          <>
            <div className="ab-stats">
              <div className="ab-stat">
                <span className="ab-stat-v">{published}</span>
                <span className="ab-stat-l">발행됨</span>
              </div>
              <div className="ab-stat">
                <span className="ab-stat-v">{drafts}</span>
                <span className="ab-stat-l">초안</span>
              </div>
              <div className="ab-stat">
                <span className="ab-stat-v">{items.length}</span>
                <span className="ab-stat-l">전체</span>
              </div>
            </div>

            <ul className="ab-table">
              <li className="ab-tr ab-th">
                <span>제목</span>
                <span>상태</span>
                <span>태그</span>
                <span>발행일</span>
                <span />
              </li>
              {items.map((post) => (
                <li className="ab-tr" key={post.id}>
                  <div className="ab-td-title">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="ab-rowtitle"
                    >
                      {post.title}
                    </Link>
                  </div>
                  <span
                    className={`ab-status ${
                      post.status === 'PUBLISHED' ? 'pub' : 'draft'
                    }`}
                  >
                    <span className="ab-status-dot" />
                    {post.status === 'PUBLISHED' ? '발행됨' : '초안'}
                  </span>
                  <span className="ab-td-tags">
                    {post.tags.map((t) => `#${t}`).join(' ')}
                  </span>
                  <span className="ab-td-date">{fmtDate(post.publishedAt)}</span>
                  <div className="ab-row-actions">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="ab-row-btn"
                    >
                      수정
                    </Link>
                    {post.status === 'DRAFT' ? (
                      <button
                        type="button"
                        onClick={() => publish.mutate(post.id)}
                        className="ab-row-btn accent"
                      >
                        발행
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => unpublish.mutate(post.id)}
                        className="ab-row-btn"
                      >
                        발행취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove.mutate(post.id)}
                      className="ab-row-btn danger"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {items.length === 0 && (
              <p className="ab-empty">아직 글이 없습니다.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
