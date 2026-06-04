import type { CommentDto } from '@blog/shared';
import { useState } from 'react';
import { fmtDate } from '../lib/format';
import { CommentForm } from './CommentForm';
import { Icon } from './Icon';

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
  // 표시 이름: authorName(로그인=계정 이름) 우선, 없으면 displayName(익명 입력) (T-WEB-015)
  const name = comment.authorName ?? comment.displayName ?? '익명';

  return (
    <li className="ab-comment">
      <div className="ab-comment-head">
        <span className="ab-avatar">{name[0]}</span>
        <div>
          <p className="ab-comment-name">{name}</p>
          <p className="ab-comment-date">{fmtDate(comment.createdAt)}</p>
        </div>
      </div>
      <p className="ab-comment-body">{comment.body}</p>
      {canReply && (
        <button
          type="button"
          onClick={() => setReplying((v) => !v)}
          className="ab-comment-reply"
        >
          <Icon name="reply" size={13} /> 답글
        </button>
      )}
      {replying && (
        <CommentForm
          postId={postId}
          parentId={comment.id}
          compact
          onCancel={() => setReplying(false)}
          onDone={() => setReplying(false)}
        />
      )}
      {comment.replies.length > 0 && (
        <ul className="ab-comment-children">
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
    return <p className="ab-empty">첫 댓글을 남겨보세요.</p>;
  }
  return (
    <ul className="ab-comment-list">
      {comments.map((comment) => (
        <CommentNode key={comment.id} comment={comment} postId={postId} />
      ))}
    </ul>
  );
}
