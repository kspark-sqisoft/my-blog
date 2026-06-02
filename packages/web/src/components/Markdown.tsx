import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

// 마크다운 렌더. rehype-sanitize 로 위험 태그/속성 제거(안전한 img만 — ADR-0003, NF1).
// 원시 HTML은 기본적으로 미파싱(react-markdown)이라 <script> 등은 텍스트로 처리된다.
export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
