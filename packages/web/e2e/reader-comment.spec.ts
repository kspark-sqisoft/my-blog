import { expect, test } from '@playwright/test';

// acceptance #2: 독자 목록 → 상세 → 깊이 2 댓글(댓글 + 답글)
test('독자가 글을 열고 댓글과 답글(깊이 2)을 남긴다', async ({ page }) => {
  const commentText = `E2E 댓글 ${Date.now()}`;
  const replyText = `E2E 답글 ${Date.now()}`;

  // Given: 공개 목록에서 첫 글을 연다
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '최근 글' }),
  ).toBeVisible();
  await page.locator('a[href^="/posts/"]').first().click();
  await page.waitForURL('**/posts/**');

  // When: 최상위 댓글을 등록한다
  await page.getByLabel('댓글 내용').first().fill(commentText);
  await page.getByRole('button', { name: '등록' }).first().click();
  const commentNode = page.locator('li', { hasText: commentText }).first();
  await expect(commentNode).toBeVisible();

  // And: 그 댓글에 답글을 단다 (깊이 2)
  await commentNode.getByRole('button', { name: '답글' }).first().click();
  await commentNode.getByLabel('댓글 내용').fill(replyText);
  await commentNode.getByRole('button', { name: '등록' }).click();

  // Then: 댓글과 답글이 모두 보인다 (답글은 댓글 노드 하위에 중첩)
  await expect(commentNode.getByText(replyText)).toBeVisible();
  await expect(page.getByText(commentText)).toBeVisible();
});
