import type { NodeViewRendererProps } from '@tiptap/core';

export interface MediaViewSpec {
  kind: 'image' | 'video';
  src: string;
  alt?: string;
  canReplace: boolean;
  onReplace: (file: File) => void;
  onDelete: () => void;
}

// 미디어 컨트롤(교체/삭제) 버튼 동작.
// ProseMirror editable 안에서는 두 가지 함정이 있다:
//   1) PM root 가 mousedown 을 가로채 NodeView 를 재선택·재렌더 → 우리 click 이 유실된다.
//   2) NodeView.stopEvent === true 이면 PM 이 이 NodeView 안 이벤트를 "처리하지 않음"으로
//      간주해 editorProps.handleDOMEvents 도 호출되지 않는다.
// 따라서 우회 경로를 두지 말고, 버튼 자체에 mousedown 리스너를 직접 붙여 PM 보다 먼저
// preventDefault + stopPropagation 으로 차단한 뒤 동작을 즉시 실행한다.
function bindMediaButton(btn: HTMLButtonElement, action: () => void): void {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  });
  // mousedown 이 click 까지 이어지지 않게 click 도 차단(이미 동작은 끝났다).
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

// 프레임워크 비의존 DOM 빌더 — 미디어 미리보기 + 호버 오버레이(교체/삭제).
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
    // file picker 열기는 사용자 제스처(mousedown) 안에서 동기 호출해야 한다.
    bindMediaButton(replaceBtn, () => input.click());

    overlay.appendChild(replaceBtn);
    frame.appendChild(input);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'ab-media-btn danger';
  deleteBtn.setAttribute('aria-label', '삭제');
  deleteBtn.setAttribute('data-media-action', 'delete');
  deleteBtn.textContent = '🗑 삭제';
  bindMediaButton(deleteBtn, () => spec.onDelete());
  overlay.appendChild(deleteBtn);

  frame.appendChild(overlay);
  root.appendChild(frame);
  return { dom: root };
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
