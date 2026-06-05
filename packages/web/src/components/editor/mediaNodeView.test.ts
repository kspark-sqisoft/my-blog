import { describe, expect, it, vi } from 'vitest';
import { buildMediaView, runMediaActionFrom } from './mediaNodeView';

// buildMediaView 는 TipTap 비의존 DOM 빌더 — 미리보기 + 삭제/교체 컨트롤.
// ProseMirror editable 안에서는 버튼 자체 click 이 발동하지 않으므로, 트리거는
// runMediaActionFrom(에디터 mousedown 에서 호출)이 담당한다.
// (TipTap 어댑터 mediaNodeView() 통합은 RichEditor 브라우저 e2e 로 검증)

describe('buildMediaView', () => {
  it('이미지는 <img> 미리보기로 렌더한다(주소 텍스트 아님)', () => {
    const { dom } = buildMediaView({
      kind: 'image',
      src: '/uploads/a.png',
      alt: '사진',
      canReplace: true,
      onReplace: vi.fn(),
      onDelete: vi.fn(),
    });
    const img = dom.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/uploads/a.png');
    expect(img?.getAttribute('alt')).toBe('사진');
  });

  it('동영상은 <video controls> 미리보기로 렌더한다', () => {
    const { dom } = buildMediaView({
      kind: 'video',
      src: '/uploads/clip.mp4',
      canReplace: true,
      onReplace: vi.fn(),
      onDelete: vi.fn(),
    });
    const video = dom.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/uploads/clip.mp4');
    expect(video?.hasAttribute('controls')).toBe(true);
  });

  it('삭제 액션 트리거 시 onDelete 가 호출된다', () => {
    const onDelete = vi.fn();
    const { dom } = buildMediaView({
      kind: 'image',
      src: '/uploads/a.png',
      canReplace: true,
      onReplace: vi.fn(),
      onDelete,
    });
    const delBtn = dom.querySelector('[data-media-action="delete"]');
    expect(delBtn).not.toBeNull();
    expect(runMediaActionFrom(delBtn)).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('교체용 파일 선택 시 onReplace(file) 가 호출된다', () => {
    const onReplace = vi.fn();
    const { dom } = buildMediaView({
      kind: 'image',
      src: '/uploads/a.png',
      canReplace: true,
      onReplace,
      onDelete: vi.fn(),
    });
    expect(dom.querySelector('[data-media-action="replace"]')).not.toBeNull();
    const input = dom.querySelector<HTMLInputElement>(
      'input[aria-label="이미지 교체"]',
    );
    expect(input).not.toBeNull();
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    Object.defineProperty(input!, 'files', { value: [file] });
    input!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onReplace.mock.calls[0][0]).toBe(file);
  });

  it('canReplace=false 면 교체 컨트롤을 숨긴다(삭제는 유지)', () => {
    const { dom } = buildMediaView({
      kind: 'image',
      src: '/uploads/a.png',
      canReplace: false,
      onReplace: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(dom.querySelector('[data-media-action="replace"]')).toBeNull();
    expect(dom.querySelector('[data-media-action="delete"]')).not.toBeNull();
  });

  it('runMediaActionFrom 은 미디어 컨트롤이 아니면 false 를 반환한다', () => {
    const div = document.createElement('div');
    expect(runMediaActionFrom(div)).toBe(false);
    expect(runMediaActionFrom(null)).toBe(false);
  });
});
