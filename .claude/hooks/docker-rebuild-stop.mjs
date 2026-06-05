#!/usr/bin/env node
// Stop 훅(옵트인): docker-rebuild-sensor 가 남긴 sentinel(.claude/.docker-dirty.json)이 있고
// AUTO_DOCKER_REBUILD=1 일 때만, 턴 종료 시 Claude 에게 재빌드 실행을 지시한다(decision: block).
//   - 기본(env 미설정)은 아무 것도 하지 않는다 — 알림은 이미 PostToolUse 센서가 했다.
//   - 실행을 Claude 의 Bash 로 위임하는 이유: 빌드 로그가 세션에 보이고, healthy 확인까지 검증되며,
//     성공 후 sentinel 을 지우면 다음 Stop 은 자동 통과한다.
//   - stop_hook_active 가드로 무한 루프를 막는다.
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

// 무한 루프 방지: Stop 훅 재진입 상태면 더 막지 않는다.
if (input.stop_hook_active) process.exit(0);

// 옵트인: 환경변수가 켜져 있을 때만 자동 실행한다.
if (process.env.AUTO_DOCKER_REBUILD !== '1') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sentinelPath = path.join(root, '.claude', '.docker-dirty.json');

let s;
try {
  s = JSON.parse(fs.readFileSync(sentinelPath, 'utf8'));
} catch {
  process.exit(0); // 펜딩 없음 → 통과
}

const DEV = '-f docker-compose.yml -f docker-compose.dev.yml';
const cmd =
  s.reason === 'deps'
    ? `docker compose ${DEV} up -d --build --renew-anon-volumes`
    : `docker compose ${DEV} up -d --build`;

const files = Array.isArray(s.files) ? s.files.join(', ') : '';

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason:
      `AUTO_DOCKER_REBUILD=1 — 재빌드 트리거 파일(${files})이 바뀌어 dev 스택 재빌드가 필요합니다.\n` +
      `종료 전에 아래를 수행하세요:\n` +
      `1) Bash 로 실행: ${cmd}\n` +
      `2) 완료 후 dev 스택이 정상인지 확인(예: docker compose ${DEV} ps 로 api/web/db Up·healthy).\n` +
      `3) 성공하면 sentinel 을 삭제: .claude/.docker-dirty.json (지워지면 이 점검은 자동 통과합니다).\n` +
      `재빌드가 실패하면 로그를 보고 원인을 고친 뒤 다시 시도하세요.`,
  }),
);
process.exit(0);
