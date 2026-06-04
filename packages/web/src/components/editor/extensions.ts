import { Mark, mergeAttributes, Node } from '@tiptap/core';

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
export const Video = Node.create({
  name: 'video',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
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
  addCommands() {
    return {
      setVideo:
        (attrs: { src: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (attrs: { src: string }) => ReturnType;
    };
  }
}
