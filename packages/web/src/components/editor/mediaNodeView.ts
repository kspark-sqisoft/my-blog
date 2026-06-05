import type { NodeViewRendererProps } from '@tiptap/core';

export interface MediaViewSpec {
  kind: 'image' | 'video';
  src: string;
  alt?: string;
  canReplace: boolean;
  onReplace: (file: File) => void;
  onDelete: () => void;
}

// 동작 핸들러를 버튼 DOM 에 실어두는 키. ProseMirror editable 안에서는 버튼의 자체 click
// 이벤트가 발동하지 않으므로(에디터 root 가 trusted 마우스 이벤트를 가로챔), 트리거는
// 에디터의 handleDOMEvents.mousedown 가 이 핸들러를 직접 호출하는 방식으로 한다.
export const MEDIA_ACTION_KEY = '__mediaAction';

type MediaActionEl = HTMLElement & { [MEDIA_ACTION_KEY]?: () => void };

// 프레임워크 비의존 DOM 빌더 — 미디어 미리보기 + 호버 오버레이(교체/삭제).
// 버튼에는 data-media-action 과 __mediaAction(실제 동작)을 실어, RichEditor 의
// handleDOMEvents.mousedown 가 호출한다.
export function buildMediaView(spec: MediaViewSpec): { dom: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'ab-media-node';

  const frame = document.createElement('div');
  frame.className = 'ab-media-frame';

  const media = document.createElement(spec.kind === 'video' ? 'video' : 'img');
  media.setAttribute('src', spec.src);
  if (spec.kind === 'video') {
    media.setAttribute('controls', '');
    media.setAttribute('preload', 'metadata');
    media.setAttribute('playsinline', '');
  } else {
    media.setAttribute('alt', spec.alt ?? '');
  }
  frame.appendChild(media);

  const overlay = document.createElement('div');
  overlay.className = 'ab-media-overlay';
  overlay.contentEditable = 'false';

  if (spec.canReplace) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = spec.kind === 'video' ? 'video/mp4' : 'image/*';
    input.hidden = true;
    input.setAttribute(
      'aria-label',
      spec.kind === 'video' ? '동영상 교체' : '이미지 교체',
    );
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) spec.onReplace(file);
    });

    const replaceBtn = document.createElement('button');
    replaceBtn.type = 'button';
    replaceBtn.className = 'ab-media-btn';
    replaceBtn.setAttribute('aria-label', '교체');
    replaceBtn.setAttribute('data-media-action', 'replace');
    replaceBtn.textContent = '🔄 교체';
    (replaceBtn as MediaActionEl)[MEDIA_ACTION_KEY] = () => input.click();

    overlay.appendChild(replaceBtn);
    frame.appendChild(input);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'ab-media-btn danger';
  deleteBtn.setAttribute('aria-label', '삭제');
  deleteBtn.setAttribute('data-media-action', 'delete');
  deleteBtn.textContent = '🗑 삭제';
  (deleteBtn as MediaActionEl)[MEDIA_ACTION_KEY] = () => spec.onDelete();
  overlay.appendChild(deleteBtn);

  frame.appendChild(overlay);
  root.appendChild(frame);
  return { dom: root };
}

// RichEditor 의 handleDOMEvents.mousedown 에서 호출. 미디어 컨트롤이면 동작을 실행하고 true 반환.
export function runMediaActionFrom(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? (target.closest('[data-media-action]') as MediaActionEl | null)
      : null;
  if (!el) return false;
  el[MEDIA_ACTION_KEY]?.();
  return true;
}

type UploadMediaFn = (
  file: File,
) => Promise<{ url: string; type: 'image' | 'video' }>;

// TipTap addNodeView 어댑터: ProseMirror 노드 ↔ buildMediaView 연결.
export function mediaNodeView() {
  return (props: NodeViewRendererProps) => {
    const { node, editor, getPos, extension } = props;
    const onUploadMedia = extension.options.onUploadMedia as
      | UploadMediaFn
      | undefined;

    const { dom } = buildMediaView({
      kind: node.type.name === 'video' ? 'video' : 'image',
      src: (node.attrs.src as string | null) ?? '',
      alt: (node.attrs.alt as string | null) ?? '',
      canReplace: !!onUploadMedia,
      onReplace: (file) => {
        if (!onUploadMedia) return;
        void onUploadMedia(file).then(({ url }) => {
          if (typeof getPos !== 'function') return;
          const pos = getPos();
          if (pos == null) return;
          editor
            .chain()
            .command(({ tr }) => {
              tr.setNodeAttribute(pos, 'src', url);
              return true;
            })
            .run();
        });
      },
      onDelete: () => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (pos == null) return;
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .run();
      },
    });

    // ProseMirror 가 이 NodeView 내부 DOM 이벤트(특히 capture 단계 mousedown)를 가로채
    // 노드를 선택·재렌더하면서 우리 버튼의 click 이 유실되는 것을 막는다.
    // 미디어는 편집 가능한 내용이 없는 leaf 라 모든 이벤트/뮤테이션을 PM 에서 무시해도 안전하다.
    return {
      dom,
      stopEvent: () => true,
      ignoreMutation: () => true,
    };
  };
}
