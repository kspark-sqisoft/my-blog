import { expect, test } from '@playwright/test';
import { loginAsOperator, typeRichBody } from './helpers';

// acceptance #3: 미발행(초안) Post 는 독자에게 노출되지 않는다
test('초안 글은 공개 목록과 상세에서 숨겨진다', async ({ page }) => {
  const title = `E2E 초안 ${Date.now()}`;

  // Given: 운영자가 초안을 작성(저장만, 발행하지 않음)한다
  await loginAsOperator(page);
  await page.getByRole('link', { name: '새 글 작성' }).click();
  await page.waitForURL('**/admin/posts/new');
  await page.getByLabel('제목', { exact: true }).fill(title);
  await typeRichBody(page, '비공개 본문');
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/admin');

  // 대시보드 행에서 초안 상태와 Post id 를 확인
  const row = page.locator('li', { hasText: title });
  await expect(row).toContainText('초안');
  const editHref = await row
    .getByRole('link', { name: '수정' })
    .getAttribute('href');
  const postId = editHref?.match(/\/admin\/posts\/(.+)\/edit/)?.[1];
  expect(postId).toBeTruthy();

  // When/Then: 공개 목록에는 제목이 없다
  await page.goto('/');
  await expect(page.getByText(title)).toHaveCount(0);

  // And: 초안 상세 직접 접근은 노출되지 않는다(에러 표시)
  await page.goto(`/posts/${postId}`);
  await expect(page.getByRole('alert')).toBeVisible();
});
