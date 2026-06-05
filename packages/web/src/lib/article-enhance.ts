// T-READ-102: 본문 HTML 을 렌더 직전 1회 변환한다(ADR-0023).
//  1) h1~h3 에 앵커 id 부여 + 목차(toc) 추출
//  2) 코드블록(pre code)에 highlight.js 자동감지 하이라이트
// 순수 변환(입력 HTML → 출력 HTML + toc). highlight.js 는 동적 import 로 번들 분리한다.

export interface TocItem {
  id: string;
  text: string;
  level: number; // 1~3
}

export interface EnhancedArticle {
  html: string;
  toc: TocItem[];
}

// 허용: 한글(완성형 + 자모), 영문/숫자, 공백, 하이픈 (api slugify 와 동일 정책, 앵커용 로컬 구현)
const DISALLOWED = /[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9\s-]/g;

// 헤딩 텍스트 → 앵커 slug. 문서 내 유일성은 호출부에서 -2/-3 으로 보장한다.
function slugifyHeading(text: string): string {
  const slug = (text ?? '')
    .toLowerCase()
    .replace(DISALLOWED, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * 본문 HTML 을 읽기용으로 보강한다.
 * - DOMParser 로 파싱 → 헤딩 id/목차 + 코드 하이라이트 적용 후 다시 직렬화.
 * - 입력이 비면 그대로 빈 결과를 돌려준다.
 */
export async function enhanceArticleHtml(
  html: string,
): Promise<EnhancedArticle> {
  if (!html) return { html: '', toc: [] };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const toc = assignHeadingIds(doc);
  await highlightCodeBlocks(doc);

  return { html: doc.body.innerHTML, toc };
}

// h1~h3 에 유일한 id 를 부여하고 toc 를 추출한다.
function assignHeadingIds(doc: Document): TocItem[] {
  const toc: TocItem[] = [];
  const used = new Map<string, number>(); // base slug → 사용 횟수

  doc.body.querySelectorAll('h1, h2, h3').forEach((el) => {
    const text = (el.textContent ?? '').trim();
    const base = slugifyHeading(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;

    el.setAttribute('id', id);
    toc.push({ id, text, level: Number(el.tagName.slice(1)) });
  });

  return toc;
}

// 코드블록을 highlight.js 자동감지로 하이라이트한다(동적 import). 실패 시 평문 유지.
async function highlightCodeBlocks(doc: Document): Promise<void> {
  const blocks = Array.from(doc.body.querySelectorAll('pre code'));
  if (blocks.length === 0) return;

  try {
    const { default: hljs } = await import('highlight.js/lib/common');
    blocks.forEach((code) => {
      const result = hljs.highlightAuto(code.textContent ?? '');
      code.innerHTML = result.value;
      code.classList.add('hljs');
      if (result.language) code.classList.add(`language-${result.language}`);
    });
  } catch {
    // highlight.js 로드 실패 시 평문 코드 그대로(graceful).
  }
}
