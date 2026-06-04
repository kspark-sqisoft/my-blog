import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

// 마크다운 렌더. rehype-sanitize 로 위험 태그/속성 제거(안전한 img만 — ADR-0003, NF1).
// 원시 HTML은 기본적으로 미파싱(react-markdown)이라 <script>·<video> 등은 텍스트로 처리된다.
// `.prose` 클래스는 e2e(.prose img) 호환을 위해 유지하고, 시각 스타일은 `.ab-md` 로 입힌다.

// 비디오로 분기할 URL 확장자(ADR-0020). 현재 MP4 만 지원.
const VIDEO_EXTENSIONS = /\.mp4(?:\?|#|$)/i;

// 마크다운 이미지 노드 ![alt](url) 를 url 확장자에 따라 <img>/<video> 로 분기 렌더한다.
// raw <video> 태그 텍스트는 react-markdown + rehype-sanitize 가 미파싱/제거하므로,
// 이 변환은 마크다운 이미지 syntax 한 가지에서만 일어난다(우회 경로 없음).
function MediaNode({ src, alt }: { src?: string; alt?: string }) {
  if (src && VIDEO_EXTENSIONS.test(src)) {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        playsInline
        aria-label={alt}
      />
    );
  }
  return <img src={src} alt={alt ?? ''} />;
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose ab-md">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{ img: MediaNode }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
