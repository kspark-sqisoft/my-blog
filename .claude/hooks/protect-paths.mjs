#!/usr/bin/env node
// PreToolUse(Edit|Write) 가드.
// (1) .env 류 파일 수정 차단 — 환경 비밀 보호 (.env.example 은 허용)
// (2) 확정(Accepted/Superseded) ADR 수정 차단 — immutable, 새 ADR로 supersede
// 차단 시 exit 2 + stderr 메시지 → Claude에게 피드백됨.
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

process.exit(0);
