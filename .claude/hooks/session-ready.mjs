#!/usr/bin/env node
// UserPromptSubmit 가드: "준비"/"/ready" 신호면 세션 시작 루틴을 주입(비차단).
// 사용자가 거의 입력 없이 같은 워크플로가 자동 작동하도록 한다.
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

const prompt = String(input.prompt || '').trim();
const isReady =
  /^\/ready\b/.test(prompt) ||
  /^준비/.test(prompt) ||
  /^(prepare|ready)\b/i.test(prompt);

if (isReady) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext:
          '[세션 시작 루틴] 묻지 말고 순서대로 실행하세요: ' +
          '(1) `bash init.sh` — 실패(비0)면 출력 보여주고 멈춤. ' +
          '(2) docs/handoff 의 최신 파일 1개 읽기. ' +
          '(3) `git log --oneline -10`. ' +
          '(4) feature_list.json 에서 status=todo, deps 전부 done, priority 최소인 태스크 1개 선택. ' +
          '(5) 그 태스크의 ID+title+acceptance 만 보여주고 멈춤 — 사용자 확인 전에는 구현 금지. ' +
          '진행 확인 후 /implement 의 TDD 절차를 따르고, 완료는 /finish 로 마감.',
      },
    }),
  );
}

process.exit(0);
