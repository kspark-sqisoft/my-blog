import { useState } from 'react';
import {
  type CreateCommentInput,
  useCreateComment,
} from '../comments/useCreateComment';

// 댓글/답글 작성 폼. parentId 가 있으면 답글로 전송. body 가 비면 등록 비활성.
export function CommentForm({
  postId,
  parentId,
  onDone,
  onCancel,
  compact,
}: {
  postId: string;
  parentId?: string;
  onDone?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [body, setBody] = useState('');
  const [displayName, setDisplayName] = useState('');
  const mutation = useCreateComment(postId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const input: CreateCommentInput = { body: body.trim() };
    if (displayName.trim()) input.displayName = displayName.trim();
    if (parentId) input.parentId = parentId;
    mutation.mutate(input, {
      onSuccess: () => {
        setBody('');
        setDisplayName('');
        onDone?.();
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`ab-cform ${compact ? 'compact' : ''}`}
    >
      <textarea
        aria-label="댓글 내용"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder={parentId ? '답글을 입력하세요' : '댓글을 입력하세요'}
        className="ab-textarea"
      />
      <div className="ab-cform-row">
        <input
          aria-label="이름(선택)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="이름 (선택)"
          className="ab-input"
        />
        <div className="ab-cform-actions">
          {onCancel && (
            <button type="button" className="ab-btn ghost sm" onClick={onCancel}>
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={!body.trim() || mutation.isPending}
            className="ab-btn sm"
          >
            등록
          </button>
        </div>
      </div>
      {mutation.isError && (
        <p role="alert" className="ab-error">
          등록에 실패했습니다. 잠시 후 다시 시도하세요.
        </p>
      )}
    </form>
  );
}
