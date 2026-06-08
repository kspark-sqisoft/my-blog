import type { CommentDto } from '@blog/shared';
import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { useDeleteComment } from '../comments/useDeleteComment';
import { useUpdateComment } from '../comments/useUpdateComment';
import { fmtDate } from '../lib/format';
import { Avatar } from './Avatar';
import { CommentForm } from './CommentForm';
import { Icon } from './Icon';

const MAX_DEPTH = 2; // ADR-0013

function CommentNode({
  comment,
  postId,
  postAuthorId,
}: {
  comment: CommentDto;
  postId: string;
  postAuthorId?: string;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const user = useAuth((s) => s.user);
  const updateM = useUpdateComment(postId);
  const deleteM = useDeleteComment(postId);

  const canReply = comment.depth < MAX_DEPTH && !comment.isDeleted;
  // 수정은 로그인 본인만(ADR-0027). 익명 댓글(userId null)은 본인이 성립하지 않음.
  const canEdit = !!user && !comment.isDeleted && comment.userId === user.id;
  // 삭제는 본인·운영자(ADMIN)·글쓴이(postAuthorId).
  const canDelete =
    !!user &&
    !comment.isDeleted &&
    (comment.userId === user.id ||
      user.role === 'ADMIN' ||
      (!!postAuthorId && user.id === postAuthorId));
  // 표시 이름: authorName(로그인=계정 이름) 우선, 없으면 displayName(익명) (T-WEB-015)
  const name = comment.authorName ?? comment.displayName ?? '익명';

  const saveEdit = () => {
    if (!draft.trim()) return;
    updateM.mutate(
      { id: comment.id, body: draft.trim() },
      { onSuccess: () => setEditing(false) },
    );
  };

  const handleDelete = () => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    deleteM.mutate(comment.id);
  };

  return (
    <li className="ab-comment">
      {comment.isDeleted ? (
        <p className="ab-comment-body ab-comment-deleted">삭제된 댓글입니다</p>
      ) : (
        <>
          <div className="ab-comment-head">
            <Avatar src={comment.authorAvatarUrl} name={name} size="sm" />
            <div>
              <p className="ab-comment-name">{name}</p>
              <p className="ab-comment-date">
                {fmtDate(comment.createdAt)}
                {comment.isEdited && (
                  <span className="ab-comment-edited"> · 수정됨</span>
                )}
              </p>
            </div>
          </div>
          {editing ? (
            <div className="ab-comment-edit">
              <textarea
                aria-label="댓글 수정"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="ab-textarea"
              />
              <div className="ab-cform-actions">
                <button
                  type="button"
                  className="ab-btn ghost sm"
                  onClick={() => {
                    setEditing(false);
                    setDraft(comment.body);
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="ab-btn sm"
                  disabled={!draft.trim() || updateM.isPending}
                  onClick={saveEdit}
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <p className="ab-comment-body">{comment.body}</p>
          )}
          <div className="ab-comment-actions">
            {canReply && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="ab-comment-reply"
              >
                <Icon name="reply" size={13} /> 답글
              </button>
            )}
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="ab-comment-action"
              >
                수정
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteM.isPending}
                className="ab-comment-action"
              >
                삭제
              </button>
            )}
          </div>
        </>
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
            <CommentNode
              key={reply.id}
              comment={reply}
              postId={postId}
              postAuthorId={postAuthorId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// 깊이 2까지 중첩된 댓글 트리 렌더 (ADR-0013). 수정·삭제 모더레이션(ADR-0027).
export function CommentTree({
  comments,
  postId,
  postAuthorId,
}: {
  comments: CommentDto[];
  postId: string;
  postAuthorId?: string;
}) {
  if (comments.length === 0) {
    return <p className="ab-empty">첫 댓글을 남겨보세요.</p>;
  }
  return (
    <ul className="ab-comment-list">
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          postId={postId}
          postAuthorId={postAuthorId}
        />
      ))}
    </ul>
  );
}
