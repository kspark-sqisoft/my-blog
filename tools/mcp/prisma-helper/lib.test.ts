import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkIndex, detectDestructive, scanPiiLogging } from './lib.ts';

const SCHEMA = `
model User {
  id    String @id @default(cuid())
  email String @unique
  name  String
}

model Post {
  id       String @id
  authorId String
  title    String
  @@index([authorId])
}
`;

test('checkIndex: @id 컬럼은 primary', () => {
  const r = checkIndex(SCHEMA, 'User', 'id');
  assert.equal(r.hasIndex, true);
  assert.equal(r.kind, 'primary');
});

test('checkIndex: @unique 컬럼', () => {
  const r = checkIndex(SCHEMA, 'User', 'email');
  assert.equal(r.hasIndex, true);
  assert.equal(r.kind, 'unique');
});

test('checkIndex: @@index 단일 컬럼', () => {
  const r = checkIndex(SCHEMA, 'Post', 'authorId');
  assert.equal(r.hasIndex, true);
  assert.equal(r.kind, 'simple');
});

test('checkIndex: 인덱스 없는 컬럼은 false', () => {
  const r = checkIndex(SCHEMA, 'User', 'name');
  assert.equal(r.hasIndex, false);
  assert.equal(r.kind, 'none');
});

test('checkIndex: 존재하지 않는 모델', () => {
  const r = checkIndex(SCHEMA, 'Nope', 'x');
  assert.equal(r.hasIndex, false);
  assert.equal(r.kind, 'none');
});

test('detectDestructive: DROP COLUMN 은 destructive', () => {
  const r = detectDestructive('ALTER TABLE "Post" DROP COLUMN "published";');
  assert.equal(r.destructive, true);
  assert.ok(r.warnings.length >= 1);
});

test('detectDestructive: nullable ADD COLUMN 은 안전', () => {
  const r = detectDestructive('ALTER TABLE "Post" ADD COLUMN "x" TEXT;');
  assert.equal(r.destructive, false);
  assert.equal(r.warnings.length, 0);
});

test('scanPiiLogging: 로깅에 PII 필드가 있으면 탐지(spec 제외)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pii-'));
  writeFileSync(
    join(dir, 'a.service.ts'),
    'this.logger.info(user.email);\nconst x = user.name;\n',
  );
  // spec 파일은 스캔 제외
  writeFileSync(join(dir, 'a.spec.ts'), 'console.log(user.password);\n');
  const r = scanPiiLogging(dir);
  assert.equal(r.total, 1);
  assert.match(r.violations[0].pattern, /email/);
});

test('scanPiiLogging: PII 없는 로깅은 통과', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pii-'));
  writeFileSync(join(dir, 'b.service.ts'), 'this.logger.info("created");\n');
  const r = scanPiiLogging(dir);
  assert.equal(r.total, 0);
});
