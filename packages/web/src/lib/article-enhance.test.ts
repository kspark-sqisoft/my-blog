import { describe, expect, it } from 'vitest';
import { enhanceArticleHtml } from './article-enhance';

describe('enhanceArticleHtml', () => {
  it('h1~h3 에 slug id 를 부여하고 toc 를 순서대로 추출한다', async () => {
    const html =
      '<h1>소개</h1><p>본문</p><h2>Getting Started</h2><h3>설치 방법</h3>';
    const { html: out, toc } = await enhanceArticleHtml(html);

    expect(toc).toEqual([
      { id: '소개', text: '소개', level: 1 },
      { id: 'getting-started', text: 'Getting Started', level: 2 },
      { id: '설치-방법', text: '설치 방법', level: 3 },
    ]);
    // 출력 HTML 의 헤딩에도 동일한 id 가 박혀 있어야 한다(앵커 스크롤 대상).
    expect(out).toContain('id="소개"');
    expect(out).toContain('id="getting-started"');
    expect(out).toContain('id="설치-방법"');
  });

  it('제목이 중복되면 id 를 -2, -3 으로 유일화한다', async () => {
    const html = '<h2>요약</h2><h2>요약</h2><h2>요약</h2>';
    const { toc } = await enhanceArticleHtml(html);
    expect(toc.map((t) => t.id)).toEqual(['요약', '요약-2', '요약-3']);
  });

  it('h4 이하 헤딩은 toc 에 포함하지 않는다', async () => {
    const html = '<h1>제목</h1><h4>작은 제목</h4>';
    const { toc } = await enhanceArticleHtml(html);
    expect(toc).toHaveLength(1);
    expect(toc[0].level).toBe(1);
  });

  it('코드블록(pre code)에 highlight.js 자동감지를 적용한다', async () => {
    const html =
      '<pre><code>function add(a, b) { return a + b; }</code></pre>';
    const { html: out } = await enhanceArticleHtml(html);
    // code 엘리먼트에 hljs 클래스가 붙고, 토큰 span 이 생성된다.
    expect(out).toContain('hljs');
    expect(out).toMatch(/<span class="hljs-/);
  });

  it('헤딩·코드가 없으면 toc 는 빈 배열이고 본문은 보존된다', async () => {
    const html = '<p>그냥 <strong>문단</strong>만 있는 글</p>';
    const { html: out, toc } = await enhanceArticleHtml(html);
    expect(toc).toEqual([]);
    expect(out).toContain('그냥');
    expect(out).toContain('<strong>문단</strong>');
  });

  it('빈 문자열도 안전하게 처리한다', async () => {
    const { html: out, toc } = await enhanceArticleHtml('');
    expect(toc).toEqual([]);
    expect(out).toBe('');
  });
});
