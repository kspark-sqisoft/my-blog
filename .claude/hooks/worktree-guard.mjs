#!/usr/bin/env node
// PostToolUse(Edit|Write) 가드(비차단·안내): 기능 소스를 default 브랜치(main)의 메인 체크아웃에서
// 직접 편집할 때, 격리 worktree 사용을 1회(세션당) 권유한다. 차단하지 않는다.
//
// 동기: 여러 세션이 같은 워킹트리를 동시에 건드리면 파일이 서로 덮인다(이번 참여/읽기경험 동시작업에서
//   PostDetail.tsx 충돌 경험). worktree(.claude/worktrees/**) 또는 별도 브랜치에서 작업하면 격리된다.
//
// 발동 조건(모두 충족 시 1회 안내):
//   - 편집 파일이 기능 소스(packages/{api,web,shared}/src/** 또는 prisma/schema.prisma)
//   - 링크된 worktree 가 아님(git-dir == git-common-dir)
//   - 현재 브랜치가 default(main) — 별도 브랜치면 이미 격리로 보고 안내하지 않음
// 세션당 1회: .claude/.worktree-guard-warned sentinel (SessionStart 가 매 세션 시작에 제거).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULT_BRANCH = 'main';

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
// 기능 소스만 대상 (문서/설정/하네스 편집은 제외)
const isFeatureSource =
  /\/packages\/(api|web|shared)\/src\//.test(norm) ||
  /\/prisma\/schema\.prisma$/.test(norm);
if (!isFeatureSource) process.exit(0);
if (/\/node_modules\//.test(norm)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// 이미 이번 세션에 안내했으면 즉시 종료(git 호출 비용 회피).
const sentinel = path.join(root, '.claude', '.worktree-guard-warned');
if (fs.existsSync(sentinel)) process.exit(0);

function git(args) {
  return execSync(`git ${args}`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

try {
  // 링크된 worktree 면 git-dir(.git/worktrees/<name>) != git-common-dir(.git) → 격리됨, 안내 안 함
  const gitDir = git('rev-parse --git-dir');
  const commonDir = git('rev-parse --git-common-dir');
  const inWorktree = path.resolve(root, gitDir) !== path.resolve(root, commonDir);
  if (inWorktree) process.exit(0);

  // 메인 체크아웃이지만 default 브랜치가 아니면(별도 브랜치) 이미 격리로 보고 안내 안 함
  const branch = git('rev-parse --abbrev-ref HEAD');
  if (branch !== DEFAULT_BRANCH) process.exit(0);
} catch {
  process.exit(0); // git 없음/판단 불가 → 조용히 통과
}

// 여기 도달 = default 브랜치 + 메인 체크아웃에서 기능 소스 편집 → 1회 안내
try {
  fs.writeFileSync(sentinel, new Date().toISOString());
} catch {
  /* sentinel 기록 실패는 비치명적 */
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `[worktree 안내] 기능 소스를 default 브랜치(${DEFAULT_BRANCH})에서 직접 편집 중입니다.\n` +
        `  다른 세션과 동시에 작업하면 같은 파일을 덮어쓸 수 있습니다(머지 충돌·유실 위험).\n` +
        `  격리가 필요하면 worktree 사용을 고려하세요: EnterWorktree(권장) 또는 \`bash scripts/worktree-new.sh <name>\`.\n` +
        `  (단발 핫픽스·문서 수정이면 무시해도 됩니다. 이 안내는 세션당 1회입니다.)`,
    },
  }),
);
process.exit(0);
