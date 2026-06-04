import { extractFirstImageUrl } from './cover-image';

// T-PUB-302: 입력은 sanitize 통과한 HTML (ADR-0021 이후). 첫 <img> 또는 <video> 의 src 를 반환.
// 이름은 호환 유지(extractFirstImageUrl) — 의미는 첫 미디어 URL 의 슈퍼셋(ADR-0020).
describe('extractFirstImageUrl (HTML 입력)', () => {
  it('첫 <img> 의 src 를 반환한다', () => {
    const html = '<p>소개</p><img src="/uploads/a.png" alt=""><p>본문</p>';
    expect(extractFirstImageUrl(html)).toBe('/uploads/a.png');
  });

  it('img 가 여러 개면 가장 먼저 나오는 것을 반환한다', () => {
    const html =
      '<img src="/uploads/1.png" alt=""> <img src="/uploads/2.png" alt="">';
    expect(extractFirstImageUrl(html)).toBe('/uploads/1.png');
  });

  it('<video src> 도 인식한다 (ADR-0020)', () => {
    const html = '<video src="/uploads/clip.mp4" controls></video>';
    expect(extractFirstImageUrl(html)).toBe('/uploads/clip.mp4');
  });

  it('img 가 video 보다 먼저면 img 의 src 를 반환한다', () => {
    const html =
      '<img src="/uploads/a.jpg" alt=""><video src="/uploads/b.mp4"></video>';
    expect(extractFirstImageUrl(html)).toBe('/uploads/a.jpg');
  });

  it('video 가 img 보다 먼저면 video 의 src 를 반환한다 (목록 카드 비디오 커버)', () => {
    const html =
      '<video src="/uploads/b.mp4"></video><img src="/uploads/a.jpg" alt="">';
    expect(extractFirstImageUrl(html)).toBe('/uploads/b.mp4');
  });

  it('미디어가 없으면 null', () => {
    expect(extractFirstImageUrl('<h1>제목</h1><p>본문</p>')).toBeNull();
  });

  it('빈 입력은 null', () => {
    expect(extractFirstImageUrl('')).toBeNull();
    expect(extractFirstImageUrl('   ')).toBeNull();
  });

  it('src 없는 video/img 는 건너뛰고 다음 미디어를 찾는다', () => {
    const html = '<img alt="missing src"><img src="/uploads/x.jpg" alt="ok">';
    expect(extractFirstImageUrl(html)).toBe('/uploads/x.jpg');
  });
});
