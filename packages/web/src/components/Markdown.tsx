import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

// 마크다운 렌더. rehype-sanitize 로 위험 태그/속성 제거(안전한 img만 — ADR-0003, NF1).
// 원시 HTML은 기본적으로 미파싱(react-markdown)이라 <script> 등은 텍스트로 처리된다.
// `.prose` 클래스는 e2e(.prose img) 호환을 위해 유지하고, 시각 스타일은 `.ab-md` 로 입힌다.
export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose ab-md">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
