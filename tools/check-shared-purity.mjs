#!/usr/bin/env node
// @blog/shared 런타임 순수성 가드 (ADR-0004, harness.md 운영 함정 #9).
//
// 왜: @blog/shared 는 "순수 타입 + 손수 작성 상수"만 두는 패키지로, 외부 런타임 의존이 0 이다.
//   누군가 zod 같은 라이브러리 값을 shared 에 넣고 index 가 값으로 re-export 하면, 그 값을 import 하는
//   모든 소비자(특히 prod api)가 부팅 시 그 라이브러리를 강제 require 한다. shared 가 그 의존을
//   package.json 에 선언하지 않으면 prod 이미지엔 없어서 MODULE_NOT_FOUND 로 크래시한다.
//   dev/CI 단위테스트는 모노레포 호이스팅으로 우연히 보여 통과하므로 prod 에서야 터진다(2026-06-08 사고).
//
// 규칙: packages/shared/dist 의 어떤 .js 도, shared package.json 의 dependencies 에 없는
//   bare(외부) 모듈을 require 하면 안 된다. (현 정책상 shared dependencies 는 비어 있어 외부 require 0)
//
// 실행: pnpm check:shared-purity  (CI quality 잡에서 shared 빌드 직후 게이트). dist 가 있어야 한다.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sharedDir = path.join(root, 'packages', 'shared');
const distDir = path.join(sharedDir, 'dist');

if (!fs.existsSync(distDir)) {
  console.error(
    'check-shared-purity: packages/shared/dist 가 없습니다 — 먼저 `pnpm --filter @blog/shared build`.',
  );
  process.exit(1);
}

const pkg = JSON.parse(
  fs.readFileSync(path.join(sharedDir, 'package.json'), 'utf8'),
);
const declared = new Set(Object.keys(pkg.dependencies ?? {}));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

// bare specifier: 첫 글자가 . (상대경로) 가 아닌 require/import 대상.
const re = /(?:require\(|(?:import|export)[^'"]*from\s+)['"]([^'".][^'"]*)['"]/g;
const offenders = new Set();

for (const file of walk(distDir)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(re)) {
    const spec = m[1];
    if (spec.startsWith('node:')) continue;
    const top = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    if (!declared.has(top)) {
      offenders.add(`${path.relative(root, file)} → require('${top}')`);
    }
  }
}

if (offenders.size > 0) {
  console.error(
    'check-shared-purity: @blog/shared 가 선언되지 않은 외부 런타임 의존을 require 합니다 ' +
      '(prod api 부팅 크래시 위험 — ADR-0004, harness.md 함정 #9):',
  );
  for (const o of offenders) console.error('  ✖ ' + o);
  console.error(
    '해결: 해당 라이브러리 스키마/값을 shared 에서 빼고 소비 패키지(web/api)로 옮기세요(검증은 각 패키지). ' +
      '정말 shared 런타임에 필요하면 packages/shared/package.json 의 dependencies 에 추가해야 합니다.',
  );
  process.exit(1);
}

console.log('check-shared-purity: 통과 — @blog/shared 외부 런타임 의존 0 ✓');
