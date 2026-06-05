import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { RICH_HTML_SPAN_CLASSES } from '@blog/shared';
import { Icon } from '../Icon';

interface ToolbarProps {
  editor: Editor;
  onUploadMedia?: (
    file: File,
  ) => Promise<{ url: string; type: 'image' | 'video' }>;
}

// 색 8 + 크기 4 — shared 의 화이트리스트와 한 쌍.
const SIZE_OPTIONS = [
  { label: '작게', class: 'text-sm' },
  { label: '보통', class: 'text-base' },
  { label: '크게', class: 'text-lg' },
  { label: '아주 크게', class: 'text-xl' },
] as const;

const COLOR_OPTIONS = [
  { label: '기본', class: 'text-slate-900', hex: '#0f172a' },
  { label: '회색', class: 'text-slate-500', hex: '#64748b' },
  { label: '빨강', class: 'text-rose-500', hex: '#f43f5e' },
  { label: '주황', class: 'text-orange-500', hex: '#f97316' },
  { label: '노랑', class: 'text-amber-500', hex: '#f59e0b' },
  { label: '초록', class: 'text-emerald-500', hex: '#10b981' },
  { label: '파랑', class: 'text-sky-500', hex: '#0ea5e9' },
  { label: '보라', class: 'text-violet-500', hex: '#8b5cf6' },
] as const;

// 화이트리스트 회귀 가드 (개발 시점 빌드 에러):
// SIZE_OPTIONS/COLOR_OPTIONS 의 클래스가 shared 의 RICH_HTML_SPAN_CLASSES 에 모두 포함되어 있어야 한다.
const _allowedClasses = new Set<string>(RICH_HTML_SPAN_CLASSES);
SIZE_OPTIONS.forEach((s) => {
  if (!_allowedClasses.has(s.class))
    throw new Error(`size class ${s.class} not in RICH_HTML_SPAN_CLASSES`);
});
COLOR_OPTIONS.forEach((c) => {
  if (!_allowedClasses.has(c.class))
    throw new Error(`color class ${c.class} not in RICH_HTML_SPAN_CLASSES`);
});

// 버튼: 아이콘(icon) 또는 글자/텍스트(label) 중 하나로 렌더한다.
function Btn({
  on,
  active = false,
  disabled = false,
  title,
  icon,
  label,
}: {
  on: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  icon?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={on}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`ab-tb-btn${active ? ' active' : ''}`}
    >
      {icon ? <Icon name={icon} size={17} /> : label}
    </button>
  );
}

function Sep() {
  return <span className="ab-tb-sep" aria-hidden="true" />;
}

export function Toolbar({ editor, onUploadMedia }: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('링크 URL', prev ?? 'https://');
    if (url === null) return; // 취소
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const onPickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadMedia) return;
    try {
      const { url, type } = await onUploadMedia(file);
      if (type === 'video') {
        editor.chain().focus().setVideo({ src: url }).run();
      } else {
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      }
    } finally {
      e.target.value = '';
    }
  };

  const alignActive = (v: 'center' | 'right') => editor.isActive({ align: v });
  const alignLeftActive = !alignActive('center') && !alignActive('right');

  return (
    <div className="ab-rich-toolbar" role="toolbar" aria-label="본문 서식">
      {/* 실행취소 / 되돌리기 */}
      <Btn
        on={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="실행취소 (Ctrl/Cmd+Z)"
        icon="undo"
      />
      <Btn
        on={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="되돌리기 (Ctrl/Cmd+Shift+Z)"
        icon="redo"
      />
      <Sep />

      {/* 제목 */}
      <Btn
        on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="제목 1"
        label="H1"
      />
      <Btn
        on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="제목 2"
        label="H2"
      />
      <Btn
        on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="제목 3"
        label="H3"
      />
      <Sep />

      {/* 인라인 서식 */}
      <Btn
        on={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="굵게 (Ctrl/Cmd+B)"
        label="B"
      />
      <Btn
        on={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="기울임 (Ctrl/Cmd+I)"
        label="I"
      />
      <Btn
        on={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="밑줄 (Ctrl/Cmd+U)"
        label="U"
      />
      <Btn
        on={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="취소선"
        label="S"
      />
      <Btn
        on={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="형광펜"
        icon="highlight"
      />
      <Btn
        on={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="인라인 코드"
        label="</>"
      />
      <Btn
        on={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive('superscript')}
        title="위첨자"
        label="x²"
      />
      <Btn
        on={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive('subscript')}
        title="아래첨자"
        label="x₂"
      />
      <Sep />

      {/* 목록 / 블록 */}
      <Btn
        on={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="글머리표"
        icon="list-bullet"
      />
      <Btn
        on={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="번호 매기기"
        icon="list-ordered"
      />
      <Btn
        on={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="인용"
        icon="quote"
      />
      <Btn
        on={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="코드 블록"
        icon="codeblock"
      />
      <Sep />

      {/* 정렬 */}
      <Btn
        on={() => editor.chain().focus().setAlign('left').run()}
        active={alignLeftActive}
        title="왼쪽 정렬"
        icon="align-left"
      />
      <Btn
        on={() => editor.chain().focus().setAlign('center').run()}
        active={alignActive('center')}
        title="가운데 정렬"
        icon="align-center"
      />
      <Btn
        on={() => editor.chain().focus().setAlign('right').run()}
        active={alignActive('right')}
        title="오른쪽 정렬"
        icon="align-right"
      />
      <Sep />

      {/* 링크 / 구분선 */}
      <Btn
        on={onLink}
        active={editor.isActive('link')}
        title="링크"
        icon="link"
      />
      <Btn
        on={() => editor.chain().focus().setHorizontalRule().run()}
        title="가로 구분선"
        icon="rule"
      />
      <Sep />

      {/* 색 / 크기 */}
      <label className="ab-tb-select">
        색
        <select
          aria-label="글자 색"
          onChange={(e) => {
            const v = e.target.value;
            editor
              .chain()
              .focus()
              .setTextColorClass(v === '__reset__' ? null : v)
              .run();
            e.target.value = '';
          }}
          defaultValue=""
        >
          <option value="" disabled>
            색
          </option>
          {COLOR_OPTIONS.map((c) => (
            <option key={c.class} value={c.class}>
              {c.label}
            </option>
          ))}
          <option value="__reset__">기본(해제)</option>
        </select>
      </label>
      <label className="ab-tb-select">
        크기
        <select
          aria-label="글자 크기"
          onChange={(e) => {
            const v = e.target.value;
            editor
              .chain()
              .focus()
              .setFontSizeClass(v === '__reset__' ? null : v)
              .run();
            e.target.value = '';
          }}
          defaultValue=""
        >
          <option value="" disabled>
            크기
          </option>
          {SIZE_OPTIONS.map((s) => (
            <option key={s.class} value={s.class}>
              {s.label}
            </option>
          ))}
          <option value="__reset__">기본(해제)</option>
        </select>
      </label>

      {/* 미디어 */}
      {onUploadMedia && (
        <>
          <Sep />
          <button
            type="button"
            className="ab-tb-btn media"
            onClick={() => fileRef.current?.click()}
            title="이미지 또는 MP4 비디오 업로드"
            aria-label="이미지 또는 MP4 비디오 업로드"
          >
            <Icon name="image" size={16} /> 미디어
          </button>
          <input
            ref={fileRef}
            type="file"
            aria-label="미디어 업로드"
            accept="image/*,video/mp4"
            onChange={onPickMedia}
            hidden
          />
        </>
      )}
    </div>
  );
}
