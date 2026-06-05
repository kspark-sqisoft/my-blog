import { describe, expect, it, vi } from 'vitest';
import { buildMediaView } from './mediaNodeView';

// buildMediaView 는 TipTap 비의존 DOM 빌더 — 미리보기 + 삭제/교체 컨트롤.
// 버튼은 자체 mousedown 리스너로 동작한다(ProseMirror 가 click 을 가로채는 것을
// 피하기 위해 mousedown 단계에서 직접 실행 + 이벤트 차단).
// (TipTap 어댑터 mediaNodeView() 통합은 RichEditor 브라우저 e2e 로 검증)

function fireMouseDown(el: Element): void {
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
  );
}

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

  it('삭제 버튼 mousedown 시 onDelete 가 호출된다(PM 가로채기 방지 위해 mousedown)', () => {
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
    fireMouseDown(delBtn!);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('교체 버튼 mousedown 시 숨겨진 file input 의 click() 을 호출한다', () => {
    const { dom } = buildMediaView({
      kind: 'image',
      src: '/uploads/a.png',
      canReplace: true,
      onReplace: vi.fn(),
      onDelete: vi.fn(),
    });
    const replaceBtn = dom.querySelector('[data-media-action="replace"]');
    expect(replaceBtn).not.toBeNull();
    const input = dom.querySelector<HTMLInputElement>(
      'input[aria-label="이미지 교체"]',
    );
    expect(input).not.toBeNull();
    const clickSpy = vi.spyOn(input!, 'click');
    fireMouseDown(replaceBtn!);
    expect(clickSpy).toHaveBeenCalledTimes(1);
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

  it('버튼 mousedown 은 stopPropagation 으로 차단된다(PM 까지 도달하지 않는다)', () => {
    const { dom } = buildMediaView({
      kind: 'image',
      src: '/uploads/a.png',
      canReplace: true,
      onReplace: vi.fn(),
      onDelete: vi.fn(),
    });
    const parent = document.createElement('div');
    parent.appendChild(dom);
    const parentSpy = vi.fn();
    parent.addEventListener('mousedown', parentSpy);
    const delBtn = dom.querySelector('[data-media-action="delete"]') as Element;
    fireMouseDown(delBtn);
    expect(parentSpy).not.toHaveBeenCalled();
  });
});
