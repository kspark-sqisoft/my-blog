#!/usr/bin/env node
// PreToolUse(Edit|Write) 가드.
// (1) .env 류 파일 수정 차단 — 환경 비밀 보호 (.env.example 은 허용)
// (2) 확정(Accepted/Superseded) ADR 수정 차단 — immutable, 새 ADR로 supersede
// (3) 적용된 마이그레이션 파일 수정 차단 — immutable, 변경은 새 migration 으로
// 차단 시 exit 2 + stderr 메시지 → Claude에게 피드백됨.
//
// PROTECTED-PATHS: env adr migrations
//   (위 한 줄은 harness-doctor 가 문서 주장과 대조하는 기계 판독용 선언이다.
//    실제 차단 로직과 항상 일치시킬 것. feature_list 무결성은 PreToolUse 가 아니라
//    verify-done-tasks(Stop) + /finish 가 강제한다 — 여기서 직접수정을 막지 않는다.)
import fs from 'node:fs';
import path from 'node:path';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    // stdin이 없을 때를 대비한 안전장치
    setTimeout(() => resolve(data), 2000);
  });
}

const raw = await readStdin();
let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path;
if (!filePath) process.exit(0);

const base = path.basename(filePath);
const norm = String(filePath).replace(/\\/g, '/');

// (1) .env 보호 (.env.example 은 허용)
if (base === '.env' || (/^\.env\./.test(base) && base !== '.env.example')) {
  process.stderr.write(
    `[차단] ${base} 는 환경 비밀이 담기는 파일입니다. 직접 수정하지 마세요.\n` +
      `정말 필요하면 사용자에게 명시적으로 확인을 요청하고, 변경은 사용자가 직접 하도록 안내하세요. ` +
      `(.env.example 갱신은 허용됩니다.)`,
  );
  process.exit(2);
}

// (2) 확정 ADR 보호 (docs/adr/NNNN-*.md, README 등 제외)
if (/\/docs\/adr\/\d{4}-[^/]*\.md$/.test(norm)) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (/^\s*(Accepted|Superseded by ADR)/m.test(content)) {
      process.stderr.write(
        `[차단] ${base} 는 확정된 ADR로 immutable 입니다.\n` +
          `결정을 바꾸려면 기존 ADR 본문을 수정하지 말고, 새 ADR을 만들어 기존 것을 supersede 하세요.\n` +
          `(상태 줄만 'Superseded by ADR-XXXX'로 바꾸는 경우라면 먼저 사용자에게 확인을 요청하세요.)`,
      );
      process.exit(2);
    }
  } catch {
    // 파일이 아직 없으면(새 ADR 생성) 허용
  }
}

// (3) 적용된 마이그레이션 보호 (prisma/migrations/<ts>_*/*.sql, migration_lock.toml)
// 이미 존재하는 파일만 차단(immutable). 새 마이그레이션 생성은 허용한다.
if (/\/prisma\/migrations\/[^/]+\/(migration\.sql|.+\.sql)$|\/prisma\/migrations\/migration_lock\.toml$/.test(
  norm,
)) {
  if (fs.existsSync(filePath)) {
    process.stderr.write(
      `[차단] ${base} 는 이미 적용된 마이그레이션으로 immutable 입니다.\n` +
        `스키마를 바꾸려면 기존 파일을 수정하지 말고 'prisma migrate dev --name ...' 로 새 마이그레이션을 만드세요.\n` +
        `(데이터 손실 가능성은 prisma-helper MCP 의 check_migration_destructive 로 먼저 점검하세요.)`,
    );
    process.exit(2);
  }
}

process.exit(0);
