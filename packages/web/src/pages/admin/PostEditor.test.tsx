import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// PostEditor 통합 spec: RichEditor 자체의 동작은 별도 spec(RichEditor.test) 가 책임.
// 여기서는 RichEditor 를 textarea 형태로 mock 해 양식·저장 흐름만 검증한다.
vi.mock('../../components/editor/RichEditor', () => ({
  RichEditor: ({
    value,
    onChange,
    onUploadMedia,
    ariaLabel,
    invalid,
  }: {
    value: string;
    onChange: (html: string) => void;
    onUploadMedia?: (
      file: File,
    ) => Promise<{ url: string; type: 'image' | 'video' }>;
    ariaLabel?: string;
    invalid?: boolean;
  }) => (
    <div>
      <textarea
        aria-label={ariaLabel ?? '본문'}
        className={invalid ? 'invalid' : ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="file"
        aria-label="미디어 업로드"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f && onUploadMedia) {
            try {
              const r = await onUploadMedia(f);
              onChange(
                `${value}${r.type === 'video' ? `<video src="${r.url}" controls preload="metadata" playsinline></video>` : `<img src="${r.url}" alt="${f.name}">`}`,
              );
            } catch {
              // 콜백이 throw 하면 무시(상위가 error 처리)
            }
          }
        }}
      />
    </div>
  ),
}));

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { api } from '../../lib/api';
import { PostEditor } from './PostEditor';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

function renderEditor(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/posts/new" element={<PostEditor />} />
          <Route path="/admin/posts/:id/edit" element={<PostEditor />} />
          <Route path="/admin" element={<div>ADMIN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PostEditor (RichEditor 통합)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('새 글 작성: 제목/본문 입력 후 저장 → POST /posts 에 contentHtml 전송', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'newid' } });
    renderEditor('/admin/posts/new');

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '새 제목' },
    });
    fireEvent.change(screen.getByLabelText('본문'), {
      target: { value: '<p>안녕</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/posts', {
        title: '새 제목',
        contentHtml: '<p>안녕</p>',
        tags: [],
      }),
    );
  });

  it('수정 모드: 기존 contentHtml 로드 + PATCH 호출', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        id: 'p1',
        title: '기존 제목',
        contentMarkdown: '기존 본문(md)',
        contentHtml: '<p>기존 본문</p>',
        tags: ['nestjs'],
        status: 'DRAFT',
        authorId: 'u1',
        publishedAt: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    });
    mockedApi.patch.mockResolvedValueOnce({ data: { id: 'p1' } });
    renderEditor('/admin/posts/p1/edit');

    const body = (await screen.findByLabelText('본문')) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe('<p>기존 본문</p>'));

    fireEvent.change(body, { target: { value: '<p>수정됨</p>' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/posts/p1',
        expect.objectContaining({ contentHtml: '<p>수정됨</p>' }),
      ),
    );
  });

  it('수정 모드(과도기): contentHtml 가 비어있으면 contentMarkdown 으로 폴백 로드', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: {
        id: 'p2',
        title: '폴백 글',
        contentMarkdown: '# 헤딩\n본문',
        contentHtml: '',
        tags: [],
        status: 'DRAFT',
        authorId: 'u1',
        publishedAt: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    });
    renderEditor('/admin/posts/p2/edit');

    const body = (await screen.findByLabelText('본문')) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe('# 헤딩\n본문'));
  });

  it('빈 본문(공백/빈 단락) 저장은 클라이언트 검증으로 차단된다', async () => {
    renderEditor('/admin/posts/new');
    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '제목 있음' },
    });
    fireEvent.change(screen.getByLabelText('본문'), {
      target: { value: '<p>   </p><p>&nbsp;</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('본문');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('제목 없이 저장하면 검증 알림 + 제목 포커스', async () => {
    renderEditor('/admin/posts/new');
    fireEvent.change(screen.getByLabelText('본문'), {
      target: { value: '<p>본문</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('제목');
    expect(screen.getByLabelText('제목')).toHaveFocus();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('미디어 업로드(이미지): POST /uploads + 본문에 <img> 노드 삽입', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        url: '/uploads/abc.png',
        contentType: 'image/png',
        size: 10,
        type: 'image',
      },
    });
    renderEditor('/admin/posts/new');

    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('미디어 업로드'), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/uploads',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        }),
      ),
    );
    await waitFor(() => {
      const body = screen.getByLabelText('본문') as HTMLTextAreaElement;
      expect(body.value).toContain('<img src="/uploads/abc.png"');
    });
  });

  it('미디어 업로드(MP4): 본문에 <video> 노드 삽입', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        url: '/uploads/clip.mp4',
        contentType: 'video/mp4',
        size: 1024,
        type: 'video',
      },
    });
    renderEditor('/admin/posts/new');

    const file = new File(['x'], 'demo.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('미디어 업로드'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      const body = screen.getByLabelText('본문') as HTMLTextAreaElement;
      expect(body.value).toContain('<video src="/uploads/clip.mp4"');
    });
  });

  it('비허용 포맷(PDF) 은 알림 + 업로드 호출되지 않는다', async () => {
    renderEditor('/admin/posts/new');
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('미디어 업로드'), {
      target: { files: [file] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/이미지|비디오/);
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('Tag 6개 이상이면 클라이언트 검증으로 저장이 막힌다', async () => {
    renderEditor('/admin/posts/new');
    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 't' },
    });
    fireEvent.change(screen.getByLabelText('본문'), {
      target: { value: '<p>b</p>' },
    });
    fireEvent.change(screen.getByLabelText('태그(쉼표로 구분)'), {
      target: { value: 'a,b,c,d,e,f' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('태그');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});
