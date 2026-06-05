#!/usr/bin/env node
// UserPromptSubmit 가드: 프롬프트에 구현 의도가 보이면 TDD 절차를 리마인드한다(비차단).
// tdd-feature 스킬과 함께 동작하며, 테스트 없이 구현부터 쓰는 것을 막도록 유도한다.
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

const prompt = String(input.prompt || '');

// 구현/기능 작업 의도 신호 (한/영) + 태스크 ID 패턴.
// 주의: '추가해/작성해' 같은 광의어는 문서·거버넌스 작업("핸드오프 작성해", "ADR 추가해")에도
// 걸려 과발화한다 → 아래 excludeRe 로 비구현 맥락을 먼저 걸러낸다(경보 피로 방지).
const implRe =
  /(구현|만들|기능\s*추가|코드\s*추가|implement|\bfeature\b|\bbuild\b|\/implement|T-[A-Z]+-\d)/i;

// 비구현(문서/거버넌스/조회) 의도 — 매칭되면 TDD 리마인드를 생략한다.
const excludeRe =
  /(핸드오프|handoff|문서|docs?|글로서리|glossary|용어|adr|prd|trd|bounded|커밋|commit|푸시|push|리뷰|review|분석|analy|설명|정리|확인|조회|읽어|보여|리팩터|refactor|이름\s*변경|rename|마이그레이션\s*문서)/i;

if (implRe.test(prompt) && !excludeRe.test(prompt)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext:
          '[TDD 가드] 구현 작업으로 보입니다. tdd-feature 스킬 절차를 따르세요: ' +
          '먼저 실패하는 테스트(RED)를 작성·실행해 "올바른 이유로" 실패함을 확인한 뒤, ' +
          '통과시킬 최소 구현(GREEN), 그다음 리팩터(REFACTOR). ' +
          '테스트 없이 구현 코드부터 작성하지 마세요. (순수 타입/설정 파일 등 테스트가 무의미한 경우는 예외)',
      },
    }),
  );
}

process.exit(0);
