import { richHtmlSchema } from '@blog/shared';

// T-INFRA-301: sanitize-html 호환 화이트리스트가 packages/shared 의 단일 소스로 노출된다.
// 본문 모델 변경(ADR-0021)의 가장 안쪽 회귀 가드 — 화이트리스트 자체가 깨지면 즉시 검출.
describe('richHtmlSchema (ADR-0021)', () => {
  it('필수 텍스트/구조 태그가 허용된다', () => {
    const allowed = new Set(richHtmlSchema.allowedTags);
    for (const tag of [
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'strong',
      'em',
      'u',
      's',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'img',
      'video',
      'span',
    ]) {
      expect(allowed.has(tag)).toBe(true);
    }
  });

  it('위험 태그는 화이트리스트에 들어가지 않는다 (XSS 표면)', () => {
    const allowed = new Set(richHtmlSchema.allowedTags);
    for (const tag of [
      'script',
      'iframe',
      'object',
      'embed',
      'style',
      'link',
      'meta',
      'form',
      'input',
      'button',
    ]) {
      expect(allowed.has(tag)).toBe(false);
    }
  });

  it('a 태그는 href/target/rel 만 허용한다', () => {
    expect(richHtmlSchema.allowedAttributes.a).toEqual(
      expect.arrayContaining(['href', 'target', 'rel']),
    );
  });

  it('img/video 의 src 는 허용되지만 on* 이벤트 핸들러는 없다', () => {
    const imgAttrs = richHtmlSchema.allowedAttributes.img ?? [];
    const videoAttrs = richHtmlSchema.allowedAttributes.video ?? [];
    expect(imgAttrs).toContain('src');
    expect(videoAttrs).toContain('src');
    for (const attrs of [imgAttrs, videoAttrs]) {
      expect(attrs.some((a) => /^on/i.test(a))).toBe(false);
    }
  });

  it('span/code/pre/p 는 class 만 허용한다 (인라인 style 금지)', () => {
    for (const tag of ['span', 'code', 'pre', 'p'] as const) {
      const attrs = richHtmlSchema.allowedAttributes[tag] ?? [];
      expect(attrs).toContain('class');
      expect(attrs).not.toContain('style');
    }
  });

  it('span 의 class 화이트리스트에 색·크기 프리셋이 포함된다', () => {
    const spanClasses = richHtmlSchema.allowedClasses?.span ?? [];
    // 크기 4단
    for (const c of ['text-sm', 'text-base', 'text-lg', 'text-xl']) {
      expect(spanClasses).toContain(c);
    }
    // 색 8 + 기본(slate-900)
    for (const c of [
      'text-slate-900',
      'text-rose-500',
      'text-sky-500',
      'text-emerald-500',
    ]) {
      expect(spanClasses).toContain(c);
    }
  });

  it('허용 스킴은 http/https/mailto/tel 만 (javascript:/data: 차단)', () => {
    const schemes = new Set(richHtmlSchema.allowedSchemes);
    for (const s of ['http', 'https', 'mailto', 'tel']) {
      expect(schemes.has(s)).toBe(true);
    }
    for (const s of ['javascript', 'data', 'vbscript', 'file']) {
      expect(schemes.has(s)).toBe(false);
    }
  });
});
