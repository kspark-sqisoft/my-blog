import { Extension, Mark, mergeAttributes, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { mediaNodeView } from './mediaNodeView';

// 미디어 교체 시 업로드를 수행하는 콜백(확장 옵션). RichEditor 가 configure 로 주입한다.
export type UploadMediaFn = (
  file: File,
) => Promise<{ url: string; type: 'image' | 'video' }>;

// T-WEB-301: 본문 모델(ADR-0021) 의 화이트리스트 정책 — 색/크기는 Tailwind 클래스로만.
// TipTap 의 Color 확장은 인라인 style 을 사용해 우리 sanitize 정책과 충돌하므로
// 두 카테고리(색/크기) 각각 별도 mark 로 분리해 span class 만 부착한다.

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColorClass: {
      setTextColorClass: (className: string | null) => ReturnType;
    };
    fontSizeClass: {
      setFontSizeClass: (className: string | null) => ReturnType;
    };
  }
}

function classMark(name: string, attrName: string) {
  return Mark.create({
    name,
    addOptions() {
      return { HTMLAttributes: {} };
    },
    addAttributes() {
      return {
        class: {
          default: null as string | null,
          parseHTML: (el) => el.getAttribute('class'),
          renderHTML: (attrs: { class?: string | null }) =>
            attrs.class ? { class: attrs.class } : {},
        },
      };
    },
    parseHTML() {
      return [{ tag: `span[data-${attrName}]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(HTMLAttributes, { [`data-${attrName}`]: '' }),
        0,
      ];
    },
  });
}

export const TextColorClass = classMark('textColorClass', 'color').extend({
  addCommands() {
    return {
      setTextColorClass:
        (className: string | null) =>
        ({ chain }) =>
          className === null
            ? chain().unsetMark('textColorClass').run()
            : chain().setMark('textColorClass', { class: className }).run(),
    };
  },
});

export const FontSizeClass = classMark('fontSizeClass', 'size').extend({
  addCommands() {
    return {
      setFontSizeClass:
        (className: string | null) =>
        ({ chain }) =>
          className === null
            ? chain().unsetMark('fontSizeClass').run()
            : chain().setMark('fontSizeClass', { class: className }).run(),
    };
  },
});

// 비디오 노드 (ADR-0020). 마크다운 본문이 아니라 에디터의 정식 노드로 다룬다.
// 우리 업로드 응답의 url 을 setVideo 명령으로 삽입. 카드는 controls/preload/playsinline.
export const Video = Node.create<{ onUploadMedia?: UploadMediaFn }>({
  name: 'video',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  addOptions() {
    return { onUploadMedia: undefined };
  },
  addAttributes() {
    return {
      src: { default: null as string | null },
    };
  },
  parseHTML() {
    return [{ tag: 'video[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: '',
        preload: 'metadata',
        playsinline: '',
      }),
    ];
  },
  // 에디터 안에서는 미리보기 + 호버 오버레이(교체/삭제)로 렌더. 직렬화(getHTML)는 renderHTML 사용.
  addNodeView() {
    return mediaNodeView();
  },
  addCommands() {
    return {
      setVideo:
        (attrs: { src: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

// 이미지 노드: 기본 Image 확장에 업로드 콜백 옵션 + 미리보기/오버레이 NodeView 추가.
export const MediaImage = Image.extend<{ onUploadMedia?: UploadMediaFn }>({
  addOptions() {
    return {
      ...this.parent?.(),
      onUploadMedia: undefined,
    };
  },
  addNodeView() {
    return mediaNodeView();
  },
});

// 형광펜: <mark> 태그. (색은 단일 — 화이트리스트에 mark 태그만 허용)
export const Highlight = Mark.create({
  name: 'highlight',
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

// 위첨자 <sup> / 아래첨자 <sub> — 상호 배타(excludes).
export const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',
  parseHTML() {
    return [{ tag: 'sup' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

export const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML() {
    return [{ tag: 'sub' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleSubscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

// 블록 정렬: 문단/제목에 align 속성을 추가하고 Tailwind 클래스로 렌더(인라인 style 금지, ADR-0021).
// 좌측은 기본값이라 클래스 없음. setAlign('left'|'center'|'right').
type AlignValue = 'left' | 'center' | 'right';

export const TextAlignClass = Extension.create<{ types: string[] }>({
  name: 'textAlignClass',
  addOptions() {
    return { types: ['paragraph', 'heading'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          align: {
            default: null as AlignValue | null,
            parseHTML: (el): AlignValue | null => {
              const cls = el.getAttribute('class') ?? '';
              if (cls.includes('text-center')) return 'center';
              if (cls.includes('text-right')) return 'right';
              return null;
            },
            renderHTML: (attrs: { align?: AlignValue | null }) => {
              if (attrs.align === 'center') return { class: 'text-center' };
              if (attrs.align === 'right') return { class: 'text-right' };
              return {};
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setAlign:
        (value: AlignValue) =>
        ({ commands }) => {
          // 좌측 = null(클래스 제거). 가운데/오른쪽 = 해당 값.
          const align = value === 'left' ? null : value;
          return this.options.types.every((type) =>
            commands.updateAttributes(type, { align }),
          );
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (attrs: { src: string }) => ReturnType;
    };
    highlight: {
      toggleHighlight: () => ReturnType;
    };
    superscript: {
      toggleSuperscript: () => ReturnType;
    };
    subscript: {
      toggleSubscript: () => ReturnType;
    };
    textAlignClass: {
      setAlign: (value: 'left' | 'center' | 'right') => ReturnType;
    };
  }
}
