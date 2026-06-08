#!/usr/bin/env node
// Stop 가드(강제): 이번 세션에서 "기능 소스(packages/*/src, prisma/schema.prisma)를
// 고친 뒤 그 변경을 code-reviewer 로 리뷰하지 않고 git commit 한" 경우
// 1회 차단(decision: block)하고 리뷰를 요구한다.
//   → 글로벌 원칙 "같은 컨텍스트에서 self-approve 금지"를 결정론적으로 강제한다.
//
// 판정 근거: transcript_path(JSONL)의 tool_use 기록을 **시간순 상태머신**으로 본다(LLM 추론 아님).
// JSONL 은 append 순서 = 시간순이므로, 순서를 반영해 "커밋 시점에 미리뷰 코드가 남아있나"를 본다:
//   - 기능 소스 수정(Edit/Write/MultiEdit, file_path 가 기능 소스) → unreviewedCode = true
//   - code-reviewer 호출(subagent_type === 'code-reviewer') → unreviewedCode = false (지금까지 수정을 리뷰가 커버)
//   - git commit(Bash) 시점에 unreviewedCode 가 true → violation = true
// violation → block. (단순 존재 여부가 아니라 순서를 보므로 "리뷰→수정→커밋"도 정확히 잡는다.)
//
// 과발화 억제:
//   - 문서/하네스만 커밋(코드 미변경) → unreviewedCode 가 안 켜짐 → 통과.
//   - 코드만 고치고 아직 커밋 안 함(작업 중) → 커밋 이벤트 없음 → 통과.
//   - 코드 수정 → code-reviewer → 커밋(정상 흐름, /finish·/implement step3/step8) → 통과.
//   - stop_hook_active 가드로 무한 루프 방지(세션당 1회 강하게 상기).
//
// 한계(설계상 수용): 커밋을 Bash tool_use 의 `git commit` 으로 수행하는 경우만 탐지한다.
//   (사용자가 IDE/외부 터미널/별도 도구로 커밋하면 transcript 에 tool_use 로 안 남아 누락될 수 있다.)
import fs from 'node:fs';

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

const tpath = input.transcript_path;
if (!tpath) process.exit(0); // 트랜스크립트 없음 → 판단 불가, 막지 않음

let content;
try {
  content = fs.readFileSync(tpath, 'utf8');
} catch {
  process.exit(0); // 읽기 실패 → 통과
}

// 기능 소스(리뷰 대상). worktree-guard 와 동일 기준. Windows·POSIX 경로 구분자 모두 허용.
const FEATURE_SRC = /packages[\\/](api|web|shared)[\\/]src[\\/]|prisma[\\/]schema\.prisma/i;

// git 서브커맨드가 commit 인 경우만 매칭한다(git 다음 옵션들 뒤 첫 서브커맨드).
// `git log --grep commit`·`git ... | grep commit` 같은 오탐을 배제한다.
const GIT_COMMIT = /\bgit\s+(?:-\S+\s+)*commit\b/;

let unreviewedCode = false; // 마지막 리뷰 이후 수정됐고 아직 리뷰 안 된 기능 소스 변경이 있는가
let violation = false; // 미리뷰 코드를 커밋한 적이 있는가

for (const line of content.split('\n')) {
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const msg = obj.message || obj;
  const items = Array.isArray(msg?.content) ? msg.content : [];
  for (const it of items) {
    if (!it || it.type !== 'tool_use') continue;
    const name = it.name;
    const inp = it.input || {};

    // 1) 기능 소스 수정 → 미리뷰 코드 발생
    if (
      (name === 'Edit' || name === 'Write' || name === 'MultiEdit') &&
      typeof inp.file_path === 'string' &&
      FEATURE_SRC.test(inp.file_path)
    ) {
      unreviewedCode = true;
    }
    // 2) code-reviewer 호출 → 지금까지의 수정을 리뷰가 커버(도구명 Task/Agent 무관)
    else if (inp.subagent_type === 'code-reviewer') {
      unreviewedCode = false;
    }
    // 3) git commit(드라이런 제외) → 이 시점에 미리뷰 코드가 남아있으면 위반
    else if (
      name === 'Bash' &&
      typeof inp.command === 'string' &&
      GIT_COMMIT.test(inp.command) &&
      !/--dry-run/.test(inp.command)
    ) {
      if (unreviewedCode) violation = true;
    }
  }
}

if (violation) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        '이번 세션에서 기능 소스(packages/*/src 또는 prisma/schema.prisma)를 수정·커밋했는데 ' +
        'code-reviewer 독립 리뷰를 거치지 않았습니다(같은 컨텍스트 self-approve 금지).\n' +
        '종료 전에 다음을 하세요:\n' +
        '1) code-reviewer 서브에이전트로 방금 변경(`git show HEAD` 또는 최근 커밋 diff)을 리뷰한다.\n' +
        '2) Critical 이 있으면 수정 후 재커밋(--amend 또는 새 커밋)한다.\n' +
        '3) 문제가 없으면 그대로 종료해도 됩니다(이 점검은 세션당 1회만 차단합니다).\n' +
        '팁: 애초에 `/finish {ID}` 또는 `/implement {ID}` 로 마감하면 code-reviewer 가 자동으로 돕니다.',
    }),
  );
}

process.exit(0);
