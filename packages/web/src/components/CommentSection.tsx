import type { CommentDto } from '@blog/shared';
import { useComments } from '../comments/useComments';
import { CommentForm } from './CommentForm';
import { CommentTree } from './CommentTree';

// 트리 전체 댓글 수(답글 포함)를 센다.
function countAll(list: CommentDto[]): number {
  return list.reduce((n, c) => n + 1 + countAll(c.replies), 0);
}

// Post 상세 하단의 댓글 영역: 작성 폼 + 깊이 2 중첩 목록.
export function CommentSection({ postId }: { postId: string }) {
  const query = useComments(postId);
  const count = query.data ? countAll(query.data) : 0;

  return (
    <section className="ab-comments">
      <h2 className="ab-comments-title">
        댓글 {count > 0 && <span>{count}</span>}
      </h2>
      <CommentForm postId={postId} />
      <div>
        {query.isPending ? (
          <p role="status" className="ab-state">
            댓글 불러오는 중…
          </p>
        ) : query.isError ? (
          <p role="alert" className="ab-state error">
            댓글을 불러오지 못했습니다.
          </p>
        ) : (
          <CommentTree comments={query.data} postId={postId} />
        )}
      </div>
    </section>
  );
}
