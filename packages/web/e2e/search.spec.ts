import { expect, test } from '@playwright/test';
import { loginAsOperator, typeRichBody } from './helpers';

// T-WEB-308 (GWT): 리스트에서 제목·본문 키워드 검색(디바운스, 비우면 전체)
test('리스트에서 키워드로 제목·본문을 검색하고, 비우면 전체가 다시 보인다', async ({
  page,
}) => {
  const stamp = Date.now();
  const kw = `zzkw${stamp}`; // 충돌 없는 고유 키워드
  const titleHit = `제목매칭 ${kw}`;
  const bodyHit = `본문매칭 글 ${stamp}`;
  const noHit = `비매칭 글 ${stamp}`;

  // Given: 제목매칭 / 본문매칭 / 비매칭 3개 글을 발행한다
  await loginAsOperator(page);
  const posts: Array<[string, string]> = [
    [titleHit, '평범한 본문'], // 제목에 kw
    [bodyHit, `본문에 ${kw} 포함`], // 본문에 kw
    [noHit, '키워드 없는 본문'], // 어디에도 kw 없음
  ];
  for (const [title, body] of posts) {
    await page.getByRole('link', { name: '새 글 작성' }).click();
    await page.waitForURL('**/admin/posts/new');
    await page.getByLabel('제목', { exact: true }).fill(title);
    await typeRichBody(page, body);
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForURL('**/admin');
    const row = page.locator('li', { hasText: title });
    await row.getByRole('button', { name: '발행' }).click();
    await expect(row).toContainText('발행됨');
  }

  // When: 공개 목록에서 키워드로 검색한다
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '최근 글' })).toBeVisible();
  await page.getByLabel('글 검색').fill(kw);

  // Then: 제목·본문 매칭만 보이고 비매칭은 숨는다, URL 에 q 반영
  await expect(page.getByRole('link', { name: titleHit })).toBeVisible();
  await expect(page.getByRole('link', { name: bodyHit })).toBeVisible();
  await expect(page.getByRole('link', { name: noHit })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${kw}`));

  // And: 검색어를 비우면 비매칭 글도 다시 보인다(전체 복원)
  await page.getByLabel('글 검색').fill('');
  await expect(page.getByRole('link', { name: noHit })).toBeVisible();
});
