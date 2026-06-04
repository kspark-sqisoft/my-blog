#!/usr/bin/env node
// PostToolUse(Edit|Write) 센서: 편집된 TS 파일을 소유 패키지의 eslint --fix 로 자동 정리한다.
// 가이드 12장 STEP 5("편집 후 자동 포맷/린트")의 우리 프로젝트 적용.
// - 대상: packages/{api,web}/**/*.{ts,tsx} (node_modules/dist 제외)
// - api eslint 는 prettier 플러그인을 포함해 포맷까지 함께 적용된다.
// - 비차단(exit 0): 자동 정리만 하고 흐름을 막지 않는다. 남은 에러는 stderr 안내만.
// 끄려면 .claude/settings.json 의 PostToolUse 블록을 제거하거나 OMC_SKIP_HOOKS 를 사용.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 2000);
  });
}

const raw = await readStdin();
let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const fp = String(input.tool_input?.file_path || '');
if (!fp) process.exit(0);

const norm = fp.replace(/\\/g, '/');
if (/\/(node_modules|dist|coverage)\//.test(norm)) process.exit(0);

// packages/{api,web} 하위 ts/tsx 만 대상
const m = norm.match(/(.*\/packages\/(api|web))\/(.+\.(ts|tsx))$/);
if (!m) process.exit(0);

const pkgDir = m[1];
const rel = m[3];

try {
  const res = spawnSync('pnpm', ['exec', 'eslint', '--fix', rel], {
    cwd: pkgDir,
    encoding: 'utf8',
    timeout: 60000,
    shell: process.platform === 'win32',
  });
  if (res.status && res.status !== 0) {
    process.stderr.write(
      `[format-edited] eslint --fix 적용 후에도 경고/에러가 남아 있을 수 있습니다: ${path.basename(rel)}\n`,
    );
  }
} catch {
  // 비차단: 포맷 실패가 작업을 막지 않는다.
}

process.exit(0);
