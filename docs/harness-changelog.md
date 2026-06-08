# Harness Changelog

> 하네스(에이전트 작업 환경) 자체의 변경 이력. 코드가 아니라 **작업 방식**을 바꾼 것을 기록한다.
> 가이드 12.5("하네스의 지속적 진화 — 버전을 매기고 PR로 리뷰") 적용.
> 갱신 주체: 하네스 파일(.claude/**, init.sh, CLAUDE.md 규칙, feature_list 스키마)을 바꾼 작업의 `/finish`.

## v0.8 (2026-06-08)

기획 단계 서브에이전트 확장 + 글로벌 설계·디자인 자산 명문화. "작성↔검토 분리"를 코드(v0.7)에서 기획으로 넓히고,
범용 설계/디자인은 글로벌(OMC·superpowers·gstack)을 호출하도록 안내해 "프로젝트 전용 남발"을 예방한다.

- **추가(`plan-critic` 서브에이전트)** — `.claude/agents/plan-critic.md`(읽기 전용): PRD·TRD·tasks·BC·ADR 의 내부 정합성(용어 일관성, PRD↔TRD 추적성, BC 1:1, ADR 분리, acceptance 테스트가능성)과 단계별 절대규칙 위반을 Critical/Warning/Suggestion 으로 검토. 기획 인터뷰는 대화형이라 위임 부적합하지만, **작성된 산출물의 독립 검토**는 저자(메인) 편향 차단에 적합.
- **배선** — `/prd`(3단계)·`/bc`(4단계)·`/trd`(5단계)·`/tasks`(7단계) 작성 직후 `plan-critic` 자동 호출, Critical 반영 후 사용자 확인. code-reviewer(코드)·verifier(acceptance)와 같은 패턴.
- **문서(글로벌 자산 명문화)** — `CLAUDE.md` 신규 섹션 "설계·디자인 보조 — 글로벌 자산을 호출한다": 발산(brainstorming/deep-interview)·범용 설계(planner/architect/critic/Plan)·UI 디자인(gstack-design-*·designer·visual-verdict·react-best-practices·Playwright MCP)을 단계별 표로 정리. **프로젝트 전용 신규 제작 대신 글로벌 호출**을 원칙화(중복·관리부담 회피). Claude 자동 인지 + 사용자 가시성 둘 다 확보. `harness.md` 에이전트 목록도 갱신.

## v0.7 (2026-06-08)

서브에이전트 배선 — "만들어 놓고 안 쓰는" 메타 드리프트 제거(v0.6 거버넌스 정합성의 연장).
`code-reviewer`·`debugger` 가 정의만 있고 자동 호출 루프에 없던 문제를 해소하고, 독립 검증 패스를 추가.

- **추가(`verifier` 서브에이전트)** — `.claude/agents/verifier.md`(읽기 전용): acceptance 를 증거(테스트 출력·curl·실행 결과)로 PASS/FAIL/**UNVERIFIED** 판정. 증거 없는 통과(UNVERIFIED)를 FAIL 동급으로 차단. 저자 편향 없는 완료 판정.
- **배선(code-reviewer 자동 호출)** — `/finish`(신규 step3)·`/implement`(신규 step8)가 **commit 직전** `code-reviewer` 서브에이전트를 자동 dispatch. **Critical 이면 commit 차단**. 글로벌 원칙("같은 컨텍스트에서 self-approve 금지")과 정합. 기존엔 CLAUDE.md 수동 안내뿐이라 사실상 미사용이었음.
- **배선(verifier 자동 호출)** — `/finish` step2(acceptance 점검)를 메인 컨텍스트 자체 점검에서 `verifier` 위임으로 전환. FAIL/UNVERIFIED 면 status=todo 유지하고 멈춤.
- **강제(Stop 훅 `review-gate`)** — `.claude/hooks/review-gate.mjs`: 슬래시 명령을 우회해도 막도록 결정론적 백스톱 추가. transcript 의 tool_use 기록을 **시간순 상태머신**으로 보아 "기능 소스(packages/*/src·prisma/schema.prisma)를 고친 뒤 그 변경을 `code-reviewer`(subagent_type) 로 리뷰하지 않고 git commit"하면 **세션당 1회 block**. 순서를 반영하므로 "리뷰→수정→커밋"(리뷰가 수정보다 앞선 경우)도 정확히 잡는다. 문서만 커밋·작업중(미커밋)·정상 흐름(수정→리뷰→커밋)·재진입(stop_hook_active)은 통과. git 서브커맨드 정규식으로 `git log --grep commit` 류 오탐 배제. 9개 시나리오(순서·Windows/POSIX 경로·오탐 포함) 단위 검증 통과. settings.json Stop 배열에 등록. (self code-review 반영: 순서 미고려 false-negative + 정규식 오탐 보강.)
- **문서(정합)** — `CLAUDE.md` 서브에이전트 안내를 "별도 패스로 호출"(수동)에서 자동 배선 사실(code-reviewer/verifier 자동, debugger 수동)로 갱신. `docs/harness.md` 훅 표·파일 목록에 `review-gate` 추가.

## v0.6 (2026-06-05)

거버넌스 정합성 보강 — "막는다고 적어놓고 안 막는 / 만들어 놓고 안 쓰는" 메타 드리프트 제거.
(외부 분석으로 발견된 5건 + 추가 가드. 메커니즘 ↔ 실제 동작 정합을 끌어올림.)

- **수정(보호 경로 드리프트)** — `protect-paths.mjs` 가 문서 주장과 달리 `migrations`·`feature_list` 를 안 막던 문제. 이제 **적용된 마이그레이션(`prisma/migrations/**`)을 immutable 로 차단**(기존 파일만, 새 마이그레이션 생성은 허용). 기계 판독용 `PROTECTED-PATHS: env adr migrations` 마커 추가. `feature_list` 무결성은 PreToolUse 가 아니라 `verify-done-tasks`(Stop)+`/finish` 가 강제함을 문서에 명시(거짓 주장 제거: changelog 참조줄/gap-analysis row6).
- **추가(드리프트 센서)** — `tools/harness-doctor.mjs`(`pnpm harness:doctor`, CI quality 차단 단계): (a) protect-paths 마커 ↔ 실제 차단 로직 ↔ 문서 주장 정합, (b) gap-analysis "N개 태스크" ↔ `feature_list.json` 실제 수치(현재 68) 정합. JSON↔MD `#### T-` 블록 수 불일치는 경고. → 1·2번 재발 방지.
- **수정(수치 드리프트)** — gap-analysis row2 `35개→68개`. (changelog 의 과거 dated 항목은 history 로 보존.)
- **배선(죽은 MCP 도구 활성화)** — `prisma-helper`(check_index/check_migration_destructive/scan_pii_logging)를 호출 루프에 연결: `code-reviewer` 에이전트 `tools:` 에 3툴 등록 + 절차 step3 추가, `/implement` step7(acceptance 검증)에 스키마/모델/로깅 변경 시 호출 명시.
- **추가(SessionStart 훅)** — `session-start.mjs`: 키워드 없이도 매 세션에 최신 handoff 1줄 + 다음 후보 자동 주입(무거운 `/ready` 루틴과 분리).
- **수정(tdd-reminder 과발화)** — 광의어(`작성해/추가해`)로 "핸드오프 작성해/ADR 추가해" 등 비구현 프롬프트에 끼어들던 문제. excludeRe(문서/거버넌스/조회 맥락) 추가 + impl 신호 정밀화 → 경보 피로 완화.
- **추가(시크릿 스캔, 규칙 #4 강제)** — `.gitleaks.toml`(기본 룰셋 + 스캐폴드/placeholder allowlist) + CI `secrets` 잡(gitleaks dir 스캔, 차단형). 로컬 docker 스캔으로 클린 검증. (.env 편집 차단만으로 못 잡던 코드 내 하드코딩을 결정론적으로 차단.)
- **추가(PreCompact 훅)** — `precompact-note.mjs`: auto-compaction 직전 브랜치/미커밋 변경/최신 handoff/다음 후보 스냅샷 주입 → 장시간 작업 doom-loop 복구 용이.

## v0.5 (2026-06-04)

`feature_list.json` ↔ `docs/tasks/{feature}.md` 동기화 강제.

- **추가** — 절대 규칙 #10(`CLAUDE.md`): JSON 태스크를 추가/완료/수정하면 같은 커밋에서 `docs/tasks/{feature}.md` 미러도 갱신. JSON 이 정규 소스, .md 는 미러.
- **변경** — `/finish`(`.claude/commands/finish.md`) step 3: feature_list 갱신과 함께 `docs/tasks` 동기화를 강제 단계로 명문화. `CLAUDE.md` `/finish` 절차 설명도 동일 반영.
- **보정** — `docs/tasks/blog-mvp.md` 를 `feature_list.json`(37 태스크)과 **완전 동기화**. 미러에서 빠져 있던 5건(E6 INFRA: T-INFRA-005·006 / E7 apple-redesign: T-WEB-009·T-PUB-103·T-WEB-010) 정의 블록 추가 + 신규 작성자 표시(E8: T-PUB-104·T-WEB-011) 반영. JSON 의 author-display 태스크 epic 을 E8 로 정규화(미러 epic 구조 정합). 검증: JSON↔MD 정의 블록 37=37, 누락·초과 0.

## v0.4 (2026-06-04)

갭 분석 P3 2건 구현.

- **추가** — 프로젝트 전용 MCP `prisma-helper`(TypeScript, `tools/mcp/prisma-helper/`): `check_index`·`check_migration_destructive`·`scan_pii_logging` 3툴. 순수 로직 TDD(9 테스트, `pnpm mcp:test` → CI quality 단계), end-to-end 스모크(`pnpm mcp:smoke`) 통과. 루트 `.mcp.json` 등록. 루트 devDeps `@modelcontextprotocol/sdk`·`tsx`·`zod` 추가.
- **추가** — git worktree 헬퍼 `scripts/worktree-new.sh`(격리 worktree + DB 분리 안내).
- **변경** — `knip.json` 에 루트 워크스페이스(`tools/**`) 엔트리 추가(MCP 파일 오탐 제거, knip 완전 클린).

## v0.3 (2026-06-04)

갭 분석 P2 2건 구현.

- **추가** — 가비지 컬렉션 센서: 루트 devDeps `knip`+`jscpd`, 설정 `knip.json`/`.jscpd.json`, 스크립트 `pnpm gc`(`gc:unused`/`gc:dup`), CI `gc` job(비차단 `continue-on-error`). 베이스라인: knip 0 미사용, jscpd 1건 중복(0.41%, 임계 미만 — PostListView↔PostDetail 태그 블록).
- **추가** — 리뷰 서브에이전트 `.claude/agents/code-reviewer.md`(읽기 전용, 절대규칙·심각도), `.claude/agents/debugger.md`(근본원인+환경 함정). 프로젝트 규칙 내장.

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
- `.claude/hooks/` — `protect-paths`(**.env/ADR/migrations 직접수정 차단**; PreToolUse 의 `PROTECTED-PATHS:` 마커가 정규 소스), `session-start`(세션 시작 시 최신 handoff+다음 후보 자동 주입, SessionStart), `tdd-reminder`(구현 의도 시 TDD 리마인드; 문서/거버넌스 프롬프트는 제외), `session-ready`(`/ready` 전체 시작 루틴), `verify-done-tasks`(검증 없는 done 차단, Stop). `feature_list.json` 무결성은 protect-paths 가 아니라 `verify-done-tasks`(Stop)+`/finish` 가 강제한다.
- `docs/harness.md` — 하네스 설계/운영 함정 기록.
