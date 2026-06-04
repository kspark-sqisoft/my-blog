import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAdminPost,
  useCreatePost,
  useUpdatePost,
  useUploadImage,
} from '../../admin/usePostEditor';
import { Icon } from '../../components/Icon';

const MAX_TAGS = 5;

// 미디어 업로드 화이트리스트 (ADR-0020). api/upload.controller 의 ALLOWED_MIME 과 한 쌍.
// accept 속성은 OS 다이얼로그 필터일 뿐 강제력이 없어, 변경 시 file.type 으로 한 번 더 검증한다.
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // 수정 모드: 기존 값이 로드되면 폼을 한 번 초기화(렌더 중 조정 패턴 — React 권장)
  if (existing.data && existing.data.id !== loadedId) {
    setLoadedId(existing.data.id);
    setTitle(existing.data.title);
    setBody(existing.data.contentMarkdown);
    setTagsInput(existing.data.tags.join(', '));
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 클라이언트 화이트리스트 검증 (서버 400 전에 차단 + 알림)
    if (!ALLOWED_UPLOAD_MIME.has(file.type)) {
      setError(
        '이미지(JPG/PNG/GIF/WEBP) 또는 MP4 비디오만 업로드할 수 있습니다.',
      );
      e.target.value = '';
      return;
    }
    setError(null);
    uploadMut.mutate(file, {
      onSuccess: (res) => {
        // 이미지/비디오 모두 마크다운 ![alt](url) 한 줄로 동일하게 삽입 (ADR-0020).
        // 렌더러가 url 확장자로 <img>/<video> 자동 분기.
        setBody((b) => `${b}\n![${file.name}](${res.url})`);
      },
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInvalidField(null);

    // 클라이언트 검증: 부족하면 서버 400 전에 알림 + 해당 필드로 포커스(흔들림)
    if (!title.trim()) {
      setError('제목을 입력하세요.');
      setInvalidField('title');
      titleRef.current?.focus();
      return;
    }
    if (!body.trim()) {
      setError('본문을 입력하세요.');
      setInvalidField('body');
      bodyRef.current?.focus();
      return;
    }
    const tags = parseTags(tagsInput);
    if (tags.length > MAX_TAGS) {
      setError(`태그는 최대 ${MAX_TAGS}개까지 가능합니다.`);
      return;
    }
    const payload = { title: title.trim(), contentMarkdown: body, tags };
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
            <label htmlFor="body" className="ab-editor-label">
              본문(마크다운)
            </label>
            <textarea
              id="body"
              ref={bodyRef}
              aria-label="본문(마크다운)"
              className={`ab-body-input${
                invalidField === 'body' ? ' invalid' : ''
              }`}
              placeholder="마크다운으로 본문을 작성하세요…"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (invalidField === 'body') setInvalidField(null);
              }}
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

            <div className="ab-panel">
              <h2 className="ab-panel-title">미디어</h2>
              <p className="ab-panel-hint">
                이미지 또는 MP4 비디오. 본문 마크다운에 한 줄로 삽입됩니다
              </p>
              <label htmlFor="media" className="ab-btn outline block sm">
                <Icon name="image" size={15} /> 파일 선택
              </label>
              <input
                id="media"
                aria-label="미디어 업로드"
                type="file"
                accept="image/*,video/mp4"
                onChange={handleUpload}
                hidden
              />
              {uploadMut.isPending && (
                <p className="ab-upload-row">업로드 중…</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}
