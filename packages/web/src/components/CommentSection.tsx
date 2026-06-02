import { useComments } from '../comments/useComments';
import { CommentForm } from './CommentForm';
import { CommentTree } from './CommentTree';

// Post 상세 하단의 댓글 영역: 작성 폼 + 깊이 2 중첩 목록.
export function CommentSection({ postId }: { postId: string }) {
  const query = useComments(postId);

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="mb-4 text-xl font-semibold">댓글</h2>
      <CommentForm postId={postId} />
      <div className="mt-4">
        {query.isPending ? (
          <p role="status" className="py-4 text-gray-500">
            댓글 불러오는 중…
          </p>
        ) : query.isError ? (
          <p role="alert" className="py-4 text-red-600">
            댓글을 불러오지 못했습니다.
          </p>
        ) : (
          <CommentTree comments={query.data} postId={postId} />
        )}
      </div>
    </section>
  );
}
