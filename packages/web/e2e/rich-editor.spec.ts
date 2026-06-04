import { expect, test } from '@playwright/test';
import { PIXEL_PNG, typeRichBody } from './helpers';

// T-WEB-304 (ADR-0021): 작성자가 WYSIWYG 에디터로 글을 쓰고, 일부 단어에 색/크기를 지정하고,
// 이미지를 업로드한 뒤 발행하면, 상세 화면에서 동일 시각이 그대로 보인다.
test('가입한 사용자가 WYSIWYG 에디터로 색/크기/이미지를 적용해 발행하면 상세에 그대로 표시된다', async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `rich-${stamp}@example.com`;
  const name = `리치${stamp}`;
  const password = 'change-me-123';
  const title = `리치 글 ${stamp}`;
  const emphasis = `강조-${stamp}`;

  // Given: 신규 가입(AUTHOR) → 자동 로그인 → 대시보드
  await page.goto('/register');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('이름').fill(name);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByRole('link', { name: '대시보드' }).click();
  await page.waitForURL('**/admin');

  // When: 새 글 작성 화면에서 본문에 텍스트를 쓴다
  await page.getByRole('link', { name: '새 글 작성' }).click();
  await page.waitForURL('**/admin/posts/new');
  await page.getByLabel('제목').fill(title);
  await typeRichBody(page, emphasis);

  // And: 본문 전체 선택 → 색(빨강) + 크기(크게) 적용
  const body = page.getByLabel('본문');
  await body.click();
  // ProseMirror 의 선택은 페이지의 단축키로 트리거
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByLabel('글자 색').selectOption('text-rose-500');
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByLabel('글자 크기').selectOption('text-lg');

  // And: 이미지 업로드 → 본문에 <img> 노드가 삽입된다
  await page.getByLabel('미디어 업로드').setInputFiles(PIXEL_PNG);
  await expect(page.locator('.ab-rich-editor img').first()).toBeVisible();

  // And: 저장 후 본인 행에서 발행
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/admin');
  const row = page.locator('li', { hasText: title });
  await expect(row).toContainText('초안');
  await row.getByRole('button', { name: '발행' }).click();
  await expect(row).toContainText('발행됨');

  // Then: 공개 상세에서 같은 색·크기 클래스와 이미지가 그대로 보인다
  await page.goto('/');
  await page.getByRole('link', { name: title }).click();
  await page.waitForURL('**/posts/**');

  const content = page.locator('.ab-rich-content');
  await expect(content.locator('img')).toBeVisible();
  // 색/크기 클래스는 span 에 부착된다(Tailwind 화이트리스트)
  await expect(content.locator('span.text-rose-500')).toHaveCount(1);
  await expect(content.locator('span.text-lg')).toHaveCount(1);
  // 본문 강조 텍스트가 보인다
  await expect(content.getByText(emphasis)).toBeVisible();
});
