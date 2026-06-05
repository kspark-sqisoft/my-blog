#!/usr/bin/env node
// PostToolUse(Edit|Write) 센서(비차단): packages/shared/src/** 가 편집되면 @blog/shared 를 즉시 재빌드한다.
//
// 왜: api(CJS)와 api 의 jest 는 @blog/shared 를 dist(빌드 산출물 index.js/index.d.ts)로 해석한다.
//   shared 소스를 고친 뒤 dist 를 안 빌드하면, 같은 세션에서 api 를 실행/테스트할 때 "no exported member"
//   류로 컴파일이 깨진다(타입이 stale). dist 는 gitignore 라 커밋으로도 갱신되지 않는다. 그래서 편집 즉시
//   dist 를 최신화해 둔다. (web 은 src 를 직접 import 하므로 영향 없음.)
//   런타임(컨테이너)·부트스트랩 경로는 docker-compose.dev.yml / init.sh 가 별도로 보장한다.
import { spawnSync } from 'node:child_process';

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

// packages/shared/src 하위 .ts 만 대상 (dist/node_modules 제외)
if (!/\/packages\/shared\/src\/.+\.ts$/.test(norm)) process.exit(0);
if (/\/(node_modules|dist)\//.test(norm)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

try {
  const res = spawnSync('pnpm', ['--filter', '@blog/shared', 'run', 'build'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    shell: process.platform === 'win32',
  });
  if (res.status && res.status !== 0) {
    process.stderr.write(
      '[shared-build] @blog/shared 빌드 실패 — 타입 오류일 수 있습니다. ' +
        'api 컴파일/테스트 전에 확인하세요.\n',
    );
  }
} catch {
  // 비차단: 빌드 실패가 편집 흐름을 막지 않는다.
}

process.exit(0);
