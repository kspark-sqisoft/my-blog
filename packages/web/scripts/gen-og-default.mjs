// 기본 OG 이미지(og-default.png) 생성 스크립트 (T-SEO-006, ADR-0026).
// 대표 이미지가 없는 글·홈·외부이미지 폴백용 1200x630 사이트명 카드.
// 새 의존성 없이 e2e 용으로 이미 설치된 Playwright(chromium)로 렌더해 PNG 로 저장한다.
// 재생성: pnpm --filter web exec node scripts/gen-og-default.mjs
import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../public/og-default.png');

const html = `<!doctype html><html><body style="margin:0">
  <div style="width:1200px;height:630px;box-sizing:border-box;display:flex;
              flex-direction:column;align-items:flex-start;justify-content:center;
              padding:96px;background:#0b0b0f;position:relative;
              font-family:Pretendard,-apple-system,system-ui,sans-serif;">
    <div style="font-size:120px;font-weight:800;color:#ffffff;letter-spacing:-2px;">디버그 노트</div>
    <div style="font-size:40px;color:#9aa0aa;margin-top:28px;">개발하며 배운 것과 디버깅 기록</div>
    <div style="position:absolute;bottom:80px;left:96px;width:120px;height:8px;background:#3b82f6;border-radius:4px;"></div>
  </div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: out, type: 'png' });
  console.log('생성 완료:', out);
} finally {
  await browser.close();
}
