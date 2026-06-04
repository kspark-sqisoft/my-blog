import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';
import { FontSizeClass, TextColorClass, Video } from './extensions';
import { Toolbar } from './Toolbar';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  onUploadMedia?: (file: File) => Promise<{ url: string; type: 'image' | 'video' }>;
  ariaLabel?: string;
  invalid?: boolean;
}

// T-WEB-301: 본문 작성용 WYSIWYG 에디터(ADR-0021). 시각 서식은 Tailwind 클래스 화이트리스트만.
// 외부에서 value(HTML 문자열) + onChange 로 제어한다. 부모는 PostEditor.
export function RichEditor({
  value,
  onChange,
  onUploadMedia,
  ariaLabel = '본문',
  invalid = false,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image,
      Video,
      TextColorClass,
      FontSizeClass,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        class: `ab-rich-editor${invalid ? ' invalid' : ''}`,
      },
    },
  });

  // 외부 value 가 비동기로 늦게 들어오는 경우(수정 모드의 prefill) 한 번 동기.
  useEffect(() => {
    if (!editor) return;
    if (value && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;
  return (
    <div className="ab-rich-editor-wrap">
      <Toolbar editor={editor} onUploadMedia={onUploadMedia} />
      <EditorContent editor={editor} />
    </div>
  );
}

export type { Editor };
