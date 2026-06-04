# Harness Changelog

> 하네스(에이전트 작업 환경) 자체의 변경 이력. 코드가 아니라 **작업 방식**을 바꾼 것을 기록한다.
> 가이드 12.5("하네스의 지속적 진화 — 버전을 매기고 PR로 리뷰") 적용.
> 갱신 주체: 하네스 파일(.claude/**, init.sh, CLAUDE.md 규칙, feature_list 스키마)을 바꾼 작업의 `/finish`.

## v0.2 (2026-06-04)

가이드(`docs/claude-code-guide/`)와의 갭 분석(`docs/harness-gap-analysis.md`) 결과 반영.

- **추가** — PostToolUse 훅 `format-edited.mjs`: 편집된 `packages/{api,web}/**/*.{ts,tsx}` 를 소유 패키지 `eslint --fix` 로 자동 포맷/린트(비차단). 가이드 12장 STEP 5 "편집 후 자동 포맷/린트" 공백을 메움.
- **추가** — `CLAUDE.md` 에 `<!-- AUTO-MANAGED:endpoints -->` 구간(코드 파생 엔드포인트 표). 가이드 12.7 패턴.
- **변경** — `/finish` 에 "자동 관리 구간 갱신"(엔드포인트 표 재생성 + 하네스 변경 시 본 changelog 기록) 단계 추가.
- **추가** — `docs/harness-gap-analysis.md`(가이드 대비 보유/미보유/권고), 본 changelog.

## v0.1 (2026-06-02, 소급 기록)

blog-mvp 기간에 구축된 초기 하네스(가이드 11·12장 STEP 1-6 구현).

- `init.sh` — 환경 1커맨드 부트스트랩(개발 DB + 테스트 DB + 헬스체크).
- `feature_list.json` — 진행 상태 정규 소스(JSON). `docs/tasks/*.md` 와 동기화.
- `.claude/commands/` — `ready`·`prd`·`bc`·`trd`·`adr`·`tasks`·`implement`·`finish` 워크플로 명령.
- `.claude/skills/tdd-feature` — 구현 의도 감지 시 TDD(Red-Green-Refactor) 강제 스킬.
- `.claude/hooks/` — `protect-paths`(.env/ADR/feature_list 보호), `tdd-reminder`(구현 의도 시 TDD 리마인드), `session-ready`(세션 시작 루틴), `verify-done-tasks`(검증 없는 done 차단, Stop).
- `docs/harness.md` — 하네스 설계/운영 함정 기록.
