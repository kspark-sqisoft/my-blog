import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAdminPost,
  useCreatePost,
  useUpdatePost,
  useUploadImage,
} from '../../admin/usePostEditor';
import { Icon } from '../../components/Icon';

const MAX_TAGS = 5;

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
  const [loadedId, setLoadedId] = useState<string | undefined>(undefined);

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
    uploadMut.mutate(file, {
      onSuccess: (res) => {
        setBody((b) => `${b}\n![${file.name}](${res.url})`);
      },
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const tags = parseTags(tagsInput);
    if (tags.length > MAX_TAGS) {
      setError(`태그는 최대 ${MAX_TAGS}개까지 가능합니다.`);
      return;
    }
    const payload = { title, contentMarkdown: body, tags };
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
        <div className="ab-editor">
          <div className="ab-editor-main">
            <input
              aria-label="제목"
              className="ab-title-input"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label htmlFor="body" className="ab-editor-label">
              본문(마크다운)
            </label>
            <textarea
              id="body"
              aria-label="본문(마크다운)"
              className="ab-body-input"
              placeholder="마크다운으로 본문을 작성하세요…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
              {error && (
                <p role="alert" className="ab-error">
                  {error}
                </p>
              )}
            </div>

            <div className="ab-panel">
              <h2 className="ab-panel-title">커버 이미지</h2>
              <p className="ab-panel-hint">본문에 마크다운 이미지로 삽입됩니다</p>
              <label htmlFor="image" className="ab-btn outline block sm">
                <Icon name="image" size={15} /> 파일 선택
              </label>
              <input
                id="image"
                aria-label="이미지 업로드"
                type="file"
                accept="image/*"
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
