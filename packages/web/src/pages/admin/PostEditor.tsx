import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAdminPost,
  useCreatePost,
  useUpdatePost,
  useUploadImage,
} from '../../admin/usePostEditor';

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
    <main className="mx-auto max-w-3xl p-6 text-left">
      <h1 className="mb-6 text-3xl font-semibold">
        {isEdit ? '글 수정' : '새 글 작성'}
      </h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm">
            제목
          </label>
          <input
            id="title"
            aria-label="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="body" className="mb-1 block text-sm">
            본문(마크다운)
          </label>
          <textarea
            id="body"
            aria-label="본문(마크다운)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full rounded border px-3 py-2 font-mono text-sm"
          />
        </div>

        <div>
          <label htmlFor="image" className="mb-1 block text-sm">
            이미지 업로드
          </label>
          <input
            id="image"
            aria-label="이미지 업로드"
            type="file"
            accept="image/*"
            onChange={handleUpload}
          />
          {uploadMut.isPending && (
            <span className="ml-2 text-sm text-gray-500">업로드 중…</span>
          )}
        </div>

        <div>
          <label htmlFor="tags" className="mb-1 block text-sm">
            태그(쉼표로 구분)
          </label>
          <input
            id="tags"
            aria-label="태그(쉼표로 구분)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="nestjs, blog"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-violet-600 px-4 py-2 text-white disabled:opacity-50"
        >
          저장
        </button>
      </form>
    </main>
  );
}
