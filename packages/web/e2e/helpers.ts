import { expect, type Page } from '@playwright/test';

// 시드된 운영자 계정(ADR-0002, .env.example 기본값). E2E 전용 자격증명.
export const OPERATOR = {
  email: process.env.OPERATOR_EMAIL ?? 'owner@example.com',
  password: process.env.OPERATOR_PASSWORD ?? 'change-me',
};

// 운영자 UI 로그인 → /admin 진입까지 대기.
export async function loginAsOperator(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('이메일').fill(OPERATOR.email);
  // '비밀번호 표시' 토글 버튼과 구분하기 위해 정확히 일치하는 라벨만 선택한다.
  await page.getByLabel('비밀번호', { exact: true }).fill(OPERATOR.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/admin');
  await expect(
    page.getByRole('heading', { name: '운영자 대시보드' }),
  ).toBeVisible();
}

// 1x1 투명 PNG (업로드 검증용 최소 이미지).
export const PIXEL_PNG = {
  name: 'pixel.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64',
  ),
};
