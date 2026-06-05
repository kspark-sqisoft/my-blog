import { expect, test } from '@playwright/test';
import { loginAsOperator, typeRichBody } from './helpers';

// T-WEB-015 acceptance #3 (GWT): 가입 → 실명 댓글 → ADMIN 승격 → 글 작성 소유권
// 멀티 컨텍스트로 회원/관리자 세션을 분리한다(공개 화면엔 로그아웃 UI 가 없어 컨텍스트로 격리).
// 다른 테스트가 만든 글에 의존하지 않도록, 댓글 달 글을 ADMIN 이 직접 발행해 자급자족한다.
test('회원이 실명으로 댓글을 남기고, AUTHOR 승격 후 글을 작성해 소유권을 가진다', async ({
  browser,
}) => {
  const stamp = Date.now();
  const email = `member-${stamp}@example.com`;
  const name = `회원${stamp}`;
  const password = 'change-me-123';
  const commentText = `실명 댓글 ${stamp}`;
  const seedTitle = `댓글용 글 ${stamp}`;

  // === 0) ADMIN 이 댓글을 달 공개 글을 준비한다 ===
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await loginAsOperator(admin); // 시드 운영자 = ADMIN
  await admin.getByRole('link', { name: '새 글 작성' }).click();
  await admin.waitForURL('**/admin/posts/new');
  await admin.getByLabel('제목', { exact: true }).fill(seedTitle);
  await typeRichBody(admin, '본문 내용입니다.');
  await admin.getByRole('button', { name: '저장' }).click();
  await admin.waitForURL('**/admin');
  const seedRow = admin.locator('li', { hasText: seedTitle });
  await seedRow.getByRole('button', { name: '발행' }).click();
  await expect(seedRow).toContainText('발행됨');

  // === 1) 회원 가입 + 실명 댓글 (회원 컨텍스트) ===
  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();

  // Given: 신규 회원으로 가입하면 자동 로그인되어 홈으로 이동한다
  await member.goto('/register');
  await member.getByLabel('이메일').fill(email);
  await member.getByLabel('이름').fill(name);
  // '비밀번호 표시' 토글 버튼과 구분하기 위해 정확히 일치하는 라벨만 선택한다.
  await member.getByLabel('비밀번호', { exact: true }).fill(password);
  await member.getByRole('button', { name: '회원가입' }).click();
  await expect(member.getByRole('heading', { name: '최근 글' })).toBeVisible();

  // When: 방금 발행한 공개 글 상세에서 댓글을 작성한다
  await member.getByRole('link', { name: seedTitle }).click();
  await member.waitForURL('**/posts/**');

  // Then: 이름(선택) 입력은 숨겨지고 계정 이름이 표시된다 (AC1)
  await expect(member.getByLabel('이름(선택)')).toHaveCount(0);

  // And: 등록하면 댓글이 계정 이름(실명)으로 표시된다 (AC2)
  await member.getByLabel('댓글 내용').first().fill(commentText);
  await member.getByRole('button', { name: '등록' }).first().click();
  const node = member.locator('li', { hasText: commentText }).first();
  await expect(node).toBeVisible();
  await expect(node.getByText(name)).toBeVisible();
  await memberCtx.close();

  // === 2) ADMIN 이 회원을 AUTHOR 로 승격한다 (adminCtx 유지) ===
  await admin.goto('/admin/users');
  const roleSelect = admin.getByLabel(`${name} 역할 변경`);
  await roleSelect.selectOption('AUTHOR');
  await expect(roleSelect).toHaveValue('AUTHOR');

  // === 3) 승격된 회원이 다시 로그인해 글 초안을 작성한다 (소유권) ===
  // 가입 시 발급된 토큰은 MEMBER 라서, 권한 갱신을 위해 새 세션으로 재로그인한다.
  const authorCtx = await browser.newContext();
  const author = await authorCtx.newPage();
  await author.goto('/login');
  await author.getByLabel('이메일').fill(email);
  await author.getByLabel('비밀번호', { exact: true }).fill(password);
  await author.getByRole('button', { name: '로그인' }).click();
  await author.waitForURL('**/admin');

  const title = `소유권 글 ${stamp}`;
  await author.getByRole('link', { name: '새 글 작성' }).click();
  await author.waitForURL('**/admin/posts/new');
  await author.getByLabel('제목', { exact: true }).fill(title);
  await typeRichBody(author, '소유권 본문 내용입니다.');
  await author.getByRole('button', { name: '저장' }).click();
  await author.waitForURL('**/admin');
  await authorCtx.close();

  // === 4) ADMIN 이 작성자의 초안을 발행한다 ===
  // ADR-0018: 대시보드 목록(GET /admin/posts)은 ADMIN 전용이라 발행은 ADMIN 이 수행한다.
  await admin.goto('/admin');
  const row = admin.locator('li', { hasText: title });
  await expect(row).toContainText('초안');
  await row.getByRole('button', { name: '발행' }).click();
  await expect(row).toContainText('발행됨');
  await adminCtx.close();

  // === 5) 공개 글 상세에 작성자(authorName)가 회원 이름으로 표시된다 (소유권) ===
  const publicCtx = await browser.newContext();
  const visitor = await publicCtx.newPage();
  await visitor.goto('/');
  await visitor.getByRole('link', { name: title }).click();
  await visitor.waitForURL('**/posts/**');
  await expect(visitor.getByText(name).first()).toBeVisible();
  await publicCtx.close();
});
