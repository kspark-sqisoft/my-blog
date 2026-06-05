#!/usr/bin/env node
// PostToolUse(Edit|Write) 센서(비차단): 도커 dev 스택을 "재빌드"해야만 반영되는 파일이
// 바뀌면, 정확한 재빌드 명령을 Claude 컨텍스트에 주입하고 펜딩 상태를 sentinel 에 기록한다.
//
// 핫리로드(소스 .ts/.tsx, Prisma 엔티티→migrate, DB 데이터)는 재빌드가 필요 없으므로 트리거가 아니다.
// 재빌드 트리거만 잡는다:
//   - package.json / pnpm-lock.yaml  → 의존성: --build --renew-anon-volumes (harness.md 함정 #1)
//   - Dockerfile(.*)                 → 이미지 정의: --build
//   - docker-compose.yml / .dev.yml  → dev 서비스 정의: --build
//   - .env (.example 제외)           → 환경 변수: --build  (※ .env 는 protect-paths 가 Edit 차단)
// dev 스택과 무관한 docker-compose.e2e.yml / .prod.yml 은 트리거에서 제외(각자 별도 기동·재빌드).
//
// 실제 재빌드 실행은 "옵트인"이다: 기본은 알림만 하고, AUTO_DOCKER_REBUILD=1 일 때만
// docker-rebuild-stop.mjs(Stop 훅)가 턴 종료 시 1회 재빌드를 수행한다.
import fs from 'node:fs';
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

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const norm = fp.replace(/\\/g, '/');
const base = path.basename(norm);

// node_modules 안의 package.json 등은 무시
if (/\/node_modules\//.test(norm)) process.exit(0);

// 트리거 분류: deps(의존성) > config(이미지/서비스/환경)
let reason = null;
if (base === 'package.json' || base === 'pnpm-lock.yaml') reason = 'deps';
else if (base === 'Dockerfile' || /^Dockerfile\./.test(base)) reason = 'config';
else if (/(^|\/)docker-compose(\.dev)?\.ya?ml$/.test(norm)) reason = 'config';
else if (base === '.env') reason = 'config';
if (!reason) process.exit(0);

const DEV = '-f docker-compose.yml -f docker-compose.dev.yml';
const CMD = {
  deps: `docker compose ${DEV} up -d --build --renew-anon-volumes`,
  config: `docker compose ${DEV} up -d --build`,
};

// sentinel 갱신 (deps 가 config 보다 강하므로 한 번 deps 면 deps 유지)
const sentinelPath = path.join(root, '.claude', '.docker-dirty.json');
let s = { reason: null, files: [] };
try {
  s = JSON.parse(fs.readFileSync(sentinelPath, 'utf8'));
} catch {
  /* 없으면 새로 */
}
if (!Array.isArray(s.files)) s.files = [];
if (s.reason !== 'deps') s.reason = reason; // deps 우선
if (!s.files.includes(base)) s.files.push(base);
try {
  fs.writeFileSync(sentinelPath, JSON.stringify(s));
} catch {
  /* sentinel 기록 실패는 비치명적 — 알림은 계속 */
}

const cmd = CMD[s.reason];
const auto = process.env.AUTO_DOCKER_REBUILD === '1';

const msg =
  `[도커 재빌드 필요] ${base} 변경 감지 — 핫리로드 대상이 아니라 dev 컨테이너에 반영되려면 재빌드가 필요합니다.\n` +
  `  실행: ${cmd}\n` +
  (s.reason === 'deps'
    ? '  (의존성 변경: 컨테이너 익명 node_modules 를 새로 만들기 위해 --renew-anon-volumes 필수 — harness.md 함정 #1)\n'
    : '') +
  (auto
    ? '  AUTO_DOCKER_REBUILD=1 → 턴 종료 시 자동으로 재빌드됩니다.'
    : '  자동 재빌드를 켜려면 AUTO_DOCKER_REBUILD=1. 그 전에는 위 명령을 사용자에게 안내(또는 확인 후 실행)하세요.');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: msg,
    },
  }),
);
process.exit(0);
