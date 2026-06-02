#!/usr/bin/env node
// Stop 가드: docs/tasks 에서 아직 커밋되지 않은 status: done 변경이 있으면
// acceptance 검증/커밋을 마치라고 피드백한다(decision: block → Claude가 계속 진행).
// 검증·커밋이 끝나면 git diff 가 비어 자동으로 통과한다.
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 2000);
  });
}

import { execSync } from 'node:child_process';

const raw = await readStdin();
let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  /* noop */
}

// 무한 루프 방지: 이미 Stop 훅으로 인해 재진입한 상태면 더 막지 않는다.
if (input.stop_hook_active) process.exit(0);

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let diff = '';
try {
  diff = execSync('git diff HEAD -- docs/tasks', {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch {
  process.exit(0); // git 없음/리포 아님 → 통과
}

const flipped = diff
  .split('\n')
  .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
  .filter((l) => /status:\s*done/i.test(l));

if (flipped.length > 0) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        '방금 status=done 으로 바꾼 태스크가 아직 커밋되지 않았습니다. 종료 전에 확인하세요:\n' +
        '1) 해당 태스크의 모든 acceptance 항목이 실제 명령 출력(테스트/검증 통과)으로 증명됐는가?\n' +
        '2) 검증이 끝났다면 handoff 작성 후 커밋했는가?\n' +
        '검증이 아직이라면 검증을 마치고, 끝났다면 커밋하세요. 커밋되면 이 점검은 자동으로 통과합니다.',
    }),
  );
}

process.exit(0);
