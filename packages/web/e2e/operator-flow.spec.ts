import { expect, test } from '@playwright/test';
import { loginAsOperator, PIXEL_PNG } from './helpers';

// acceptance #1: 운영자 로그인 → 작성 → 이미지 업로드 → 발행
test('운영자가 글을 작성하고 이미지를 올린 뒤 발행한다', async ({ page }) => {
  const title = `E2E 작성 ${Date.now()}`;

  // Given: 운영자로 로그인한 상태
  await loginAsOperator(page);

  // When: 새 글 작성 화면에서 제목/본문 입력
  await page.getByRole('link', { name: '새 글 작성' }).click();
  await page.waitForURL('**/admin/posts/new');
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('본문(마크다운)').fill('# E2E 본문\n\n내용입니다.');

  // And: 이미지를 업로드하면 본문에 마크다운 이미지가 삽입된다
  await page.getByLabel('이미지 업로드').setInputFiles(PIXEL_PNG);
  await expect(page.getByLabel('본문(마크다운)')).toHaveValue(/!\[pixel\.png\]/);

  // And: 저장하면 대시보드로 이동하고 초안으로 표시된다
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/admin');
  const row = page.locator('li', { hasText: title });
  await expect(row).toContainText('초안');

  // Then: 발행하면 상태가 '발행됨'으로 바뀐다
  await row.getByRole('button', { name: '발행' }).click();
  await expect(row).toContainText('발행됨');

  // And: 공개 목록에 노출된다
  await page.goto('/');
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  // And: 상세에서 업로드 이미지가 실제로 렌더된다(깨진 이미지 회귀 방지)
  await page.getByRole('link', { name: title }).click();
  await page.waitForURL('**/posts/**');
  const img = page.locator('.prose img').first();
  await expect(img).toBeVisible();
  await expect
    .poll(() =>
      img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});
