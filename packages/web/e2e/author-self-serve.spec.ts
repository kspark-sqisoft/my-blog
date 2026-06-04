import { expect, test } from '@playwright/test';

// ADR-0019: 공개 가입자는 가입 즉시 AUTHOR 라서, 운영자 승격 없이
// 본인 글을 작성·발행하고 자기 대시보드에서 관리할 수 있다.
test('가입한 사용자가 승격 없이 바로 글을 작성·발행하고 대시보드에서 관리한다', async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `author-${stamp}@example.com`;
  const name = `작성자${stamp}`;
  const password = 'change-me-123';
  const title = `자급자족 글 ${stamp}`;

  // Given: 신규 가입(기본 역할 AUTHOR) → 자동 로그인되어 홈으로 이동
  await page.goto('/register');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('이름').fill(name);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '회원가입' }).click();
  await expect(page.getByRole('heading', { name: '최근 글' })).toBeVisible();

  // When: 승격 없이 대시보드로 들어가 새 글을 작성한다
  await page.getByRole('link', { name: '대시보드' }).click();
  await page.waitForURL('**/admin');
  await page.getByRole('link', { name: '새 글 작성' }).click();
  await page.waitForURL('**/admin/posts/new');
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('본문(마크다운)').fill('# 본문\n\n내용입니다.');
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/admin');

  // Then: 본인 대시보드 목록에 방금 쓴 초안이 보인다 (작성자 스코프 목록)
  const row = page.locator('li', { hasText: title });
  await expect(row).toContainText('초안');

  // And: 본인이 직접 발행할 수 있다 (소유권 기반)
  await row.getByRole('button', { name: '발행' }).click();
  await expect(row).toContainText('발행됨');

  // And: 공개 글 상세에 작성자(authorName)가 본인 이름으로 표시된다
  await page.goto('/');
  await page.getByRole('link', { name: title }).click();
  await page.waitForURL('**/posts/**');
  await expect(page.getByText(name).first()).toBeVisible();
});
