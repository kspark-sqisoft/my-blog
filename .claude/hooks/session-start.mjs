#!/usr/bin/env node
// SessionStart 훅(비차단): 키워드 입력 없이도 매 세션에 최소 컨텍스트를 주입한다.
//  - docs/handoff 최신 1건의 파일명 + 첫 제목줄
//  - feature_list.json 의 다음 후보(todo, deps 전부 done, priority 최소) 1건
// 무거운 루틴(init.sh 등)은 '/ready'(session-ready.mjs)가 담당한다 — 여기선 읽기 전용 요약만.
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function latestHandoff() {
  try {
    const dir = path.join(root, 'docs', 'handoff');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    if (!files.length) return null;
    const name = files[files.length - 1];
    const body = fs.readFileSync(path.join(dir, name), 'utf8');
    const title = (body.split('\n').find((l) => l.trim().startsWith('#')) || '')
      .replace(/^#+\s*/, '')
      .trim();
    return { name, title };
  } catch {
    return null;
  }
}

function nextCandidate() {
  try {
    const fl = JSON.parse(
      fs.readFileSync(path.join(root, 'feature_list.json'), 'utf8'),
    );
    const tasks = Array.isArray(fl.tasks) ? fl.tasks : [];
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const ready = tasks
      .filter((t) => t.status === 'todo')
      .filter((t) =>
        (t.deps || []).every((d) => byId[d] && byId[d].status === 'done'),
      )
      .sort((a, b) => (a.priority ?? 1e9) - (b.priority ?? 1e9));
    const done = tasks.filter((t) => t.status === 'done').length;
    return { ready: ready[0] || null, done, total: tasks.length };
  } catch {
    return null;
  }
}

const h = latestHandoff();
const c = nextCandidate();

const lines = ['[세션 컨텍스트 — 자동 주입(읽기 전용 요약)]'];
if (h) lines.push(`· 최신 handoff: ${h.name}${h.title ? ` — ${h.title}` : ''}`);
if (c) {
  lines.push(`· 진행: ${c.done}/${c.total} done`);
  lines.push(
    c.ready
      ? `· 다음 후보: ${c.ready.id} — ${c.ready.title}`
      : '· 다음 후보: 없음(모든 todo 가 막혀있거나 백로그 비어있음)',
  );
}
lines.push(
  '필요하면 "/ready" 로 전체 시작 루틴(init.sh·git log·태스크 확정)을 실행하세요.',
);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
  }),
);
process.exit(0);
