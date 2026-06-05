#!/usr/bin/env node
// PreCompact 훅(비차단): auto-compaction 이 컨텍스트를 줄이기 전에
// "지금 어디까지 했나"를 한 묶음으로 다시 주입해 장시간 작업의 복구를 돕는다.
//  - 현재 브랜치 + 미커밋 변경 요약(git status --short)
//  - 최신 handoff 파일명
//  - feature_list 진행/다음 후보
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function latestHandoff() {
  try {
    const dir = path.join(root, 'docs', 'handoff');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
    return files.length ? files[files.length - 1] : null;
  } catch {
    return null;
  }
}

function progress() {
  try {
    const fl = JSON.parse(
      fs.readFileSync(path.join(root, 'feature_list.json'), 'utf8'),
    );
    const tasks = fl.tasks || [];
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const next = tasks
      .filter((t) => t.status === 'todo')
      .filter((t) => (t.deps || []).every((d) => byId[d]?.status === 'done'))
      .sort((a, b) => (a.priority ?? 1e9) - (b.priority ?? 1e9))[0];
    const done = tasks.filter((t) => t.status === 'done').length;
    return { done, total: tasks.length, next };
  } catch {
    return null;
  }
}

const branch = sh('git rev-parse --abbrev-ref HEAD');
const status = sh('git status --short');
const h = latestHandoff();
const p = progress();

const lines = ['[PreCompact 스냅샷 — compaction 전 현재 작업 상태]'];
if (branch) lines.push(`· 브랜치: ${branch}`);
lines.push(
  status
    ? `· 미커밋 변경:\n${status.split('\n').slice(0, 30).join('\n')}`
    : '· 미커밋 변경: 없음(클린)',
);
if (h) lines.push(`· 최신 handoff: ${h}`);
if (p)
  lines.push(
    `· 진행: ${p.done}/${p.total} done` +
      (p.next ? ` / 다음 후보: ${p.next.id} — ${p.next.title}` : ''),
  );
lines.push(
  '작업이 끝나지 않았다면 이어서 진행하고, 마무리 단계면 /finish 로 검증·커밋하세요.',
);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext: lines.join('\n'),
    },
  }),
);
process.exit(0);
