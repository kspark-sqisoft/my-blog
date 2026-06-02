import type { CommentDto } from '@blog/shared';
import { useState } from 'react';
import { CommentForm } from './CommentForm';

const MAX_DEPTH = 2; // ADR-0013

function CommentNode({
  comment,
  postId,
}: {
  comment: CommentDto;
  postId: string;
}) {
  const [replying, setReplying] = useState(false);
  const canReply = comment.depth < MAX_DEPTH;

  return (
    <li className="py-3">
      <div>
        <p className="text-xs text-gray-500">
          {comment.displayName ?? '익명'} · {comment.createdAt.slice(0, 10)}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
        {canReply && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="mt-1 text-xs text-violet-600 hover:underline"
          >
            답글
          </button>
        )}
        {replying && (
          <CommentForm
            postId={postId}
            parentId={comment.id}
            onDone={() => setReplying(false)}
          />
        )}
      </div>
      {comment.replies.length > 0 && (
        <ul className="ml-6 border-l pl-4">
          {comment.replies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} postId={postId} />
          ))}
        </ul>
      )}
    </li>
  );
}

// 깊이 2까지 중첩된 댓글 트리 렌더 (ADR-0013)
export function CommentTree({
  comments,
  postId,
}: {
  comments: CommentDto[];
  postId: string;
}) {
  if (comments.length === 0) {
    return <p className="py-4 text-gray-500">첫 댓글을 남겨보세요.</p>;
  }
  return (
    <ul className="divide-y">
      {comments.map((comment) => (
        <CommentNode key={comment.id} comment={comment} postId={postId} />
      ))}
    </ul>
  );
}
