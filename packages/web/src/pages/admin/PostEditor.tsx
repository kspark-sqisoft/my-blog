import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAdminPost,
  useCreatePost,
  useUpdatePost,
  useUploadImage,
} from '../../admin/usePostEditor';
import { RichEditor } from '../../components/editor/RichEditor';

const MAX_TAGS = 5;

// 미디어 업로드 화이트리스트 (ADR-0020). api/upload.controller 의 ALLOWED_MIME 과 한 쌍.
const ALLOWED_UPLOAD_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
]);

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// HTML 본문의 평문 텍스트가 비었는지(공백/빈 단락) 검증.
function isBlankHtmlBody(html: string): boolean {
  if (!html) return true;
  // 태그 제거 후 공백 정리(클라이언트 단순 검증 — 서버 검증이 최종 게이트)
  const text = html.replace(/<[^>]*>/g, '').replace(/\s|&nbsp;/g, '');
  return text.length === 0;
}

export function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const existing = useAdminPost(id);
  const createMut = useCreatePost();
  const updateMut = useUpdatePost(id ?? '');
  const uploadMut = useUploadImage();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  // 검증 실패한 필드(테두리 강조/흔들림 + 포커스 대상)
  const [invalidField, setInvalidField] = useState<'title' | 'body' | null>(
    null,
  );
  const [loadedId, setLoadedId] = useState<string | undefined>(undefined);

  const titleRef = useRef<HTMLInputElement>(null);

  // 수정 모드: 기존 값이 로드되면 폼을 한 번 초기화(렌더 중 조정 패턴 — React 권장).
  // ADR-0021: 본문은 contentHtml 우선, 없으면 contentMarkdown 폴백.
  if (existing.data && existing.data.id !== loadedId) {
    setLoadedId(existing.data.id);
    setTitle(existing.data.title);
    setBody(existing.data.contentHtml || existing.data.contentMarkdown);
    setTagsInput(existing.data.tags.join(', '));
  }

  // 미디어 업로드 콜백(RichEditor 도구바에서 호출).
  // 클라이언트 화이트리스트 검증 후 서버 업로드 → 응답을 RichEditor 가 setImage/setVideo.
  const onUploadMedia = async (
    file: File,
  ): Promise<{ url: string; type: 'image' | 'video' }> => {
    if (!ALLOWED_UPLOAD_MIME.has(file.type)) {
      setError(
        '이미지(JPG/PNG/GIF/WEBP) 또는 MP4 비디오만 업로드할 수 있습니다.',
      );
      throw new Error('blocked-mime');
    }
    setError(null);
    const res = await uploadMut.mutateAsync(file);
    return { url: res.url, type: res.type };
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInvalidField(null);

    if (!title.trim()) {
      setError('제목을 입력하세요.');
      setInvalidField('title');
      titleRef.current?.focus();
      return;
    }
    if (isBlankHtmlBody(body)) {
      setError('본문을 입력하세요.');
      setInvalidField('body');
      return;
    }
    const tags = parseTags(tagsInput);
    if (tags.length > MAX_TAGS) {
      setError(`태그는 최대 ${MAX_TAGS}개까지 가능합니다.`);
      return;
    }
    const payload = { title: title.trim(), contentHtml: body, tags };
    const onSuccess = () => navigate('/admin');
    if (isEdit) {
      updateMut.mutate(payload, { onSuccess });
    } else {
      createMut.mutate(payload, { onSuccess });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <form onSubmit={handleSave}>
      <header className="ab-admin-bar">
        <h1>{isEdit ? '글 수정' : '새 글 작성'}</h1>
        <div className="ab-bar-actions">
          <Link to="/admin" className="ab-btn ghost">
            취소
          </Link>
          <button type="submit" disabled={saving} className="ab-btn">
            저장
          </button>
        </div>
      </header>

      <div className="ab-admin-body">
        {error && (
          <p role="alert" className="ab-form-error">
            {error}
          </p>
        )}
        <div className="ab-editor">
          <div className="ab-editor-main">
            <input
              ref={titleRef}
              aria-label="제목"
              className={`ab-title-input${
                invalidField === 'title' ? ' invalid' : ''
              }`}
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (invalidField === 'title') setInvalidField(null);
              }}
            />
            <label className="ab-editor-label">본문</label>
            <RichEditor
              value={body}
              onChange={(html) => {
                setBody(html);
                if (invalidField === 'body') setInvalidField(null);
              }}
              onUploadMedia={onUploadMedia}
              ariaLabel="본문"
              invalid={invalidField === 'body'}
            />
          </div>

          <aside className="ab-editor-side">
            <div className="ab-panel">
              <h2 className="ab-panel-title">태그</h2>
              <p className="ab-panel-hint">쉼표(,)로 구분 · 최대 {MAX_TAGS}개</p>
              <input
                aria-label="태그(쉼표로 구분)"
                className="ab-input"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="nestjs, blog"
              />
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}
