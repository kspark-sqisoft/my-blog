#!/usr/bin/env node
// harness-doctor — 하네스 거버넌스 드리프트 센서.
// "막는다고 적어놓고 안 막는" / "수치가 현실과 어긋나는" 메타 드리프트를 CI 에서 잡는다.
//
// 하드 체크(실패 시 exit 1):
//   1) protect-paths.mjs 의 PROTECTED-PATHS 마커 ↔ 실제 차단 로직 일치
//   2) protect-paths 보호 집합 ↔ 문서(gap-analysis row6 / changelog 참조줄) 주장 일치
//      - 보호하는 토큰(.env/ADR/migrations)은 문서가 모두 언급해야 한다
//      - protect-paths 가 막지 않는 자산(feature_list)을 "protect-paths 가 막는다"고
//        주장하면 실패(거짓 주장 금지)
//   3) gap-analysis 의 "N개 태스크" 수치 ↔ feature_list.json 실제 태스크 수 일치
// 소프트 체크(경고만, exit 0 유지):
//   4) feature_list.json 태스크 수 ↔ docs/tasks/*.md 의 `#### T-` 정의 블록 수
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];
const warnings = [];

// ── 1) PROTECTED-PATHS 마커 ↔ 실제 차단 로직 ──────────────────────────
const hook = read('.claude/hooks/protect-paths.mjs');
const markerMatch = hook.match(/PROTECTED-PATHS:\s*([a-z _]+)/i);
if (!markerMatch) {
  errors.push('protect-paths.mjs 에 `PROTECTED-PATHS:` 마커가 없습니다.');
}
const protectedSet = markerMatch
  ? markerMatch[1].trim().split(/\s+/).filter(Boolean)
  : [];

// 각 토큰이 실제 차단 로직으로 구현돼 있는지(휴리스틱) 확인
const implEvidence = {
  env: /base === '\.env'|\.env\./,
  adr: /docs\/adr\//,
  migrations: /prisma\/migrations\//,
};
for (const tok of protectedSet) {
  const re = implEvidence[tok];
  if (!re) {
    warnings.push(`마커 토큰 '${tok}' 에 대한 구현 증거 패턴이 정의돼 있지 않습니다.`);
    continue;
  }
  if (!re.test(hook)) {
    errors.push(
      `마커는 '${tok}' 를 보호한다고 선언했지만 protect-paths.mjs 에 해당 차단 로직이 없습니다.`,
    );
  }
}

// ── 2) 보호 집합 ↔ 문서 주장 일치 ────────────────────────────────────
// 토큰 → 문서에서 찾을 표기
const tokenDocStr = { env: '.env', adr: 'ADR', migrations: 'migrations' };
const gap = read('docs/harness-gap-analysis.md');
const changelog = read('docs/harness-changelog.md');

const gapRow6 = gap.split('\n').find((l) => /보호 경로 훅/.test(l)) || '';
// changelog 의 "훅 인벤토리" 줄(보호 집합을 선언하는 정규 줄)만 본다.
// 산문/이력 줄에도 'protect-paths' 가 등장하므로 `.claude/hooks/` 토큰으로 인벤토리 줄을 특정한다.
const changelogProtectLine =
  changelog
    .split('\n')
    .find((l) => /`\.claude\/hooks\/`/.test(l) && /protect-paths/.test(l)) ||
  '';

for (const tok of protectedSet) {
  const s = tokenDocStr[tok];
  if (s && !gapRow6.includes(s)) {
    errors.push(
      `gap-analysis 보호경로 행이 보호 토큰 '${s}' 를 언급하지 않습니다(문서 드리프트).`,
    );
  }
  if (s && !changelogProtectLine.includes(s)) {
    errors.push(
      `changelog protect-paths 줄이 보호 토큰 '${s}' 를 언급하지 않습니다(문서 드리프트).`,
    );
  }
}

// 거짓 주장 금지: protect-paths 가 막지 않는데 "protect-paths 가 막는다"고 적힌 자산
const notProtected = ['feature_list'];
for (const asset of notProtected) {
  if (protectedSet.includes(asset)) continue; // 실제로 보호하면 통과
  if (changelogProtectLine.includes(`${asset}`) &&
      /보호|차단/.test(changelogProtectLine) &&
      !/무결성|verify-done|finish/.test(changelogProtectLine)) {
    errors.push(
      `changelog 가 '${asset}' 를 protect-paths 보호 대상으로 주장하지만 훅은 막지 않습니다(거짓 주장).`,
    );
  }
}

// ── 3) gap-analysis "N개 태스크" ↔ feature_list 실제 수 ───────────────
const fl = JSON.parse(read('feature_list.json'));
const taskCount = Array.isArray(fl.tasks) ? fl.tasks.length : 0;
for (const m of gap.matchAll(/(\d+)\s*개\s*태스크/g)) {
  const cited = Number(m[1]);
  if (cited !== taskCount) {
    errors.push(
      `gap-analysis 가 '${cited}개 태스크'로 적었지만 feature_list.json 은 ${taskCount}개입니다(수치 드리프트).`,
    );
  }
}

// ── 4) feature_list ↔ docs/tasks ID 집합 정합(절대규칙 #10) ──────────
// 고유 ID 집합으로 비교한다(총 헤더 수가 아니라). 누락/초과는 하드 실패,
// 같은 ID 가 여러 .md 에 중복 정의된 것은 경고(미러 오염, 정리 권장).
const tasksDir = path.join(root, 'docs', 'tasks');
const jsonIds = new Set((fl.tasks || []).map((t) => t.id));
const mdIds = [];
for (const f of fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'))) {
  const body = fs.readFileSync(path.join(tasksDir, f), 'utf8');
  for (const m of body.matchAll(/^####\s+(T-[A-Z]+-\d+)/gm)) mdIds.push(m[1]);
}
const mdSet = new Set(mdIds);
const missingInMd = [...jsonIds].filter((id) => !mdSet.has(id));
const extraInMd = [...mdSet].filter((id) => !jsonIds.has(id));
const dupInMd = [...new Set(mdIds.filter((x, i) => mdIds.indexOf(x) !== i))];
if (missingInMd.length)
  errors.push(`docs/tasks 미러에 누락된 태스크: ${missingInMd.join(', ')}`);
if (extraInMd.length)
  errors.push(`docs/tasks 에만 있고 JSON 에 없는 태스크: ${extraInMd.join(', ')}`);
if (dupInMd.length)
  warnings.push(
    `docs/tasks 에 중복 정의된 태스크 헤더(정리 권장): ${dupInMd.join(', ')}`,
  );

// ── 리포트 ───────────────────────────────────────────────────────────
console.log(`harness-doctor: 보호집합=[${protectedSet.join(', ')}], 태스크=${taskCount}`);
for (const w of warnings) console.log(`  ⚠ WARN  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  ✖ FAIL  ${e}`);
  console.error(`harness-doctor: ${errors.length}건 실패`);
  process.exit(1);
}
console.log('harness-doctor: 통과 ✅');
process.exit(0);
