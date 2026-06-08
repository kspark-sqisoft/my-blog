#!/usr/bin/env node
// Stop 가드(강제): 이번 세션에서 "기능 소스(packages/*/src, prisma/schema.prisma)를
// 수정하고 git commit 했는데 code-reviewer 서브에이전트 독립 리뷰를 거치지 않은" 경우
// 1회 차단(decision: block)하고 리뷰를 요구한다.
//   → 글로벌 원칙 "같은 컨텍스트에서 self-approve 금지"를 결정론적으로 강제한다.
//
// 판정 근거: transcript_path(JSONL)의 tool_use 기록만 본다(LLM 추론 아님).
//   - codeTouched: Edit/Write/MultiEdit 의 file_path 가 기능 소스
//   - committed  : Bash 의 git commit 실행
//   - reviewed   : subagent_type === 'code-reviewer' 인 서브에이전트 호출(Task/Agent 도구)
// codeTouched && committed && !reviewed → block.
//
// 과발화 억제:
//   - 문서/하네스만 커밋(코드 미변경) → codeTouched=false → 통과.
//   - 코드만 고치고 아직 커밋 안 함(작업 중) → committed=false → 통과.
//   - /finish·/implement 로 마감하면 step3/step8 이 code-reviewer 를 호출 → reviewed=true → 통과.
//   - stop_hook_active 가드로 무한 루프 방지(세션당 1회 강하게 상기).
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

let codeTouched = false;
let committed = false;
let reviewed = false;

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

    // 코드 수정: Edit/Write/MultiEdit 의 대상이 기능 소스
    if (
      (name === 'Edit' || name === 'Write' || name === 'MultiEdit') &&
      typeof inp.file_path === 'string' &&
      FEATURE_SRC.test(inp.file_path)
    ) {
      codeTouched = true;
    }

    // 커밋: Bash 의 git commit(드라이런 제외)
    if (
      name === 'Bash' &&
      typeof inp.command === 'string' &&
      /\bgit\b[^\n]*\bcommit\b/.test(inp.command) &&
      !/--dry-run/.test(inp.command)
    ) {
      committed = true;
    }

    // 리뷰: code-reviewer 서브에이전트 호출(도구명 Task/Agent 무관, subagent_type 으로 판정)
    if (inp.subagent_type === 'code-reviewer') {
      reviewed = true;
    }
  }
}

if (codeTouched && committed && !reviewed) {
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
