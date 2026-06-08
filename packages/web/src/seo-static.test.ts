/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// T-SEO-006: index.html 정적 SEO 메타 + 기본 OG 이미지 자산 (ADR-0026).
// vitest 는 packages/web 에서 실행되므로 cwd 기준으로 정적 파일을 검증한다.
describe('seo static meta (T-SEO-006)', () => {
  const root = process.cwd();
  const html = readFileSync(resolve(root, 'index.html'), 'utf-8');

  it('RSS 피드 자동발견 link(rel=alternate, application/rss+xml, /feed.xml)', () => {
    expect(html).toMatch(
      /<link[^>]+rel="alternate"[^>]+type="application\/rss\+xml"[^>]+href="\/feed\.xml"/,
    );
  });

  it('사이트 기본 OG 메타(og:site_name·og:title·og:description·og:image·twitter:card)', () => {
    expect(html).toContain('property="og:site_name"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
    // 기본 OG 이미지 경로 참조
    expect(html).toContain('/og-default.png');
  });

  it('기본 OG 이미지 자산(public/og-default.png) 이 유효한 PNG', () => {
    const path = resolve(root, 'public/og-default.png');
    expect(existsSync(path)).toBe(true);
    // PNG 매직바이트 — image/png 로 서빙되려면 파일이 실제 PNG 여야(규칙 #9 정신).
    const buf = readFileSync(path);
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
