# 하네스 갭 분석 — 가이드 대비 보강

> 기준 문서: `docs/claude-code-guide/claude_code_guide.pdf` (특히 **11장 10-Phase 워크플로우**, **12장 Harness Engineering STEP 1-6**, 7장 Hooks, 16장 Verification).
> 목적: 우리 프로젝트 하네스(`.claude/**`, `init.sh`, `CLAUDE.md`, `feature_list.json`, `docs/`)가 가이드 권고를 얼마나 따르는지 점검하고 보완점을 정리한다.
> 변경 이력은 `docs/harness-changelog.md`.

## 1. 현황 매트릭스 (가이드 메커니즘 → 우리 보유 여부)

| # | 가이드 메커니즘 | 근거(장) | 우리 상태 | 비고 |
|---|---|---|---|---|
| 1 | `init.sh` 1커맨드 부트스트랩 + 헬스체크 | 12 STEP1 | ✅ 보유 | `init.sh` |
| 2 | `feature_list.json` 진행 상태 정규 소스 | 12 STEP3 | ✅ 보유 | 105개 태스크 (harness-doctor 가 이 수치 ↔ JSON 정합 검사) |
| 3 | Phase별 슬래시 명령(/prd~/finish) | 11 | ✅ 보유 | `.claude/commands/` 9종 |
| 4 | `tdd-feature` 스킬(Red-Green-Refactor 강제) | 12 STEP6 | ✅ 보유 | description 자동 트리거 |
| 5 | 세션 시작 루틴 훅 | 12 STEP2 | ✅ 보유 | `session-start.mjs`(SessionStart 자동) + `session-ready.mjs`(`/ready` 수동 전체 루틴) |
| 6 | 보호 경로 훅(.env/ADR/migrations) | 7, 12 STEP5 | ✅ 보유 | `protect-paths.mjs`(PreToolUse, `PROTECTED-PATHS:` 마커 = 정규 소스; harness-doctor 가 문서와 정합 검사) |
| 7 | 검증 없는 done 차단(Stop 훅) | 12 STEP5, 16 | ✅ 보유 | `verify-done-tasks.mjs` |
| 8 | DDD/ADR/handoff 문서 환류 | 11 P1·3·5·10 | ✅ 보유 | glossary/bc/adr/handoff |
| 9 | **편집 후 자동 포맷/린트 훅(PostToolUse)** | 7, 12 STEP5 | ✅ **추가됨(v0.2)** | 이전엔 공백 → `format-edited.mjs` |
| 10 | **CLAUDE.md AUTO-MANAGED 구간(코드 파생)** | 12.7 | ✅ **추가됨(v0.2)** | 엔드포인트 표 + /finish 갱신 |
| 11 | **하네스 changelog(버전·진화 기록)** | 12.5 | ✅ **추가됨(v0.2)** | `docs/harness-changelog.md` |
| 12 | 지속적 가비지 컬렉션(unused/중복 감지) | 12.5 | ✅ **추가됨(v0.3)** | knip(미사용) + jscpd(중복), CI 비차단 job `gc` |
| 13 | 전용 리뷰 패스(code-reviewer/debugger 서브에이전트) | 6 | ✅ **추가됨(v0.3)** | `.claude/agents/{code-reviewer,debugger}.md`(프로젝트 규칙 내장) |
| 14 | git worktree 병렬·격리 작업 | 12.8 | ✅ **추가됨(v0.4)** | `scripts/worktree-new.sh`(헬퍼 + DB 격리 안내) |
| 15 | 프로젝트 전용 MCP(스키마/PII 가드) | 8.5 | ✅ **추가됨(v0.4)** | TS MCP `prisma-helper`(check_index·migration·pii) |
| 16 | 4-Phase per-task 루프 명문화 | 12.7 | ⚠️ 암묵 | 10-Phase는 있으나 태스크 단위 루프 미명문 → 권고 P1(문서) |
| 17 | CI에서 lint/type/test/e2e 자동화 | 15 | ✅ 보유 | `.github/workflows/ci.yml`(ADR-0014) |

## 2. 이번에 보완한 것 (v0.2 — 적용 완료)

1. **PostToolUse 자동 포맷/린트 훅** `format-edited.mjs`
   - 편집된 `packages/{api,web}/**/*.{ts,tsx}` 를 소유 패키지 `eslint --fix` 로 정리(api 는 prettier 플러그인 포함). 비차단.
   - 검증: `export const x=1` → `export const x = 1;` 자동 교정 확인. 깨끗한 파일은 무변경.
   - 끄기: `.claude/settings.json` 의 `PostToolUse` 블록 제거 또는 `OMC_SKIP_HOOKS`.
2. **CLAUDE.md `AUTO-MANAGED:endpoints` 구간** — 컨트롤러에서 파생한 엔드포인트 표. 손으로 고치지 말고 `/finish` 가 갱신.
3. **`/finish` 4단계 추가** — 엔드포인트 변경 시 AUTO-MANAGED 재생성 + 하네스 변경 시 changelog 기록.
4. **`docs/harness-changelog.md`** 신설(가이드 12.5).

## 2-bis. 추가 보완 (v0.3 — 적용 완료)

- **가비지 컬렉션 센서** — `knip`(미사용 파일/export) + `jscpd`(중복). 루트 스크립트 `pnpm gc`(+`gc:unused`/`gc:dup`), 설정 `knip.json`·`.jscpd.json`, CI `gc` job(비차단, `continue-on-error`).
  - 베이스라인: **knip 0 미사용**(클린). **jscpd 1건 중복**(0.41%, 임계 5% 미만 → 비차단): 태그 렌더 블록이 `PostListView.tsx` ↔ `PostDetail.tsx` 에 중복 → 후속으로 `<TagList>` 컴포넌트 추출 권장(선택).
  - 노이즈 억제: knip 은 `.claude/**`·설정파일·프레임워크 진입점(Nest module/controller, jest setup) 처리, 의존성 검사는 제외(툴링 deps 오탐 방지). jscpd 는 `*.spec/*.test`·migrations 제외.
- **리뷰 서브에이전트** — `.claude/agents/code-reviewer.md`(읽기 전용, 절대규칙·ADR·심각도 분류), `.claude/agents/debugger.md`(근본원인 우선, 우리 환경 함정 내장). OMC 전역 에이전트를 프로젝트 규칙으로 특화.

## 2-ter. 추가 보완 (v0.4 — 적용 완료, P3)

- **프로젝트 전용 MCP `prisma-helper`** (TypeScript, `tools/mcp/prisma-helper/`) — 우리 규칙을 Claude 가 직접 부를 수 있는 가드 툴로 승격.
  - `check_index(model, column)` — 인덱스 누락(성능), `check_migration_destructive()` — 파괴적 마이그레이션(데이터 손실), `scan_pii_logging()` — PII 로깅(보안).
  - 순수 로직(`lib.ts`)은 **TDD**(9 테스트, `pnpm mcp:test`, CI quality 단계). 전체 경로는 `pnpm mcp:smoke` 로 검증(툴 3개 등록·호출 확인). 루트 `.mcp.json` 등록.
  - 가이드는 Python FastMCP 예시지만 rule #1(TS-only)에 맞춰 `@modelcontextprotocol/sdk`+`tsx` 로 TS 구현(빌드 불필요).
- **git worktree 헬퍼** `scripts/worktree-new.sh` — `../my-blog-wt-<name>` + 브랜치 `wt/<name>` 생성, DB 격리(전용 `blog_<name>`) 안내. 단일 개발자엔 advanced/선택.

## 3. 남은 권고 (우선순위 · 비용 · 영향)

### P1 — 4-Phase 태스크 루프 명문화 (문서, 저비용) — ✅ 완료(v0.2, CLAUDE.md)
- **왜**: 가이드 12.7 은 태스크 1건을 `① 이해+계획(plan) → ② 구현(TDD) → ③ 검증(lint/type/test+자기리뷰) → ④ 문서화(handoff)` 4단계 루프로 돈다. 우리 10-Phase 는 "기능" 단위라, "태스크 1건" 단위 루프가 암묵적이다.
- **어떻게**: `CLAUDE.md` 또는 `/implement` 에 4-Phase 루프를 1블록으로 명시(이미 `/implement`+`tdd-feature`+`verify-done-tasks` 가 메커니즘은 갖춤 — 말로만 고정하면 됨).
- **비용**: 문서 5분.

> P2(가비지 컬렉션 센서, 리뷰 서브에이전트)은 **v0.3**, P3(worktree, 전용 MCP)은 **v0.4** 에서 완료 — §2-bis / §2-ter 참고.

### 검토 대상 — Stop 검증을 의미(semantic) 센서로
- 가이드 12.4/16 은 "검증 센서가 사람 말이 아니라 LLM 이 보게" 한다(prompt 타입 Stop). 우리 `verify-done-tasks.mjs` 는 결정적(파일 존재/상태)이라 빠르고 견고하다. 굳이 prompt 로 바꾸지 말고 **결정적 가드 유지 + 필요 시 prompt 보조** 권장(현행 유지).

## 4. 의도적으로 채택하지 않은 것
- **Dynamic Workflows / Agent Teams 상시화**: 저볼륨 1인 블로그라 over-engineering(가이드도 "doom-loop 경계"). 명시 요청 시에만.
- **AUTO-MANAGED 자동(훅) 갱신**: 우선 `/finish` 수동 갱신으로 충분. 엔드포인트가 잦게 바뀌면 PostToolUse/Stop 자동화로 승격.

## 5. 한 줄 결론
핵심 루프(init→feature_list→TDD→검증 훅→handoff→commit)는 가이드와 정합한다. v0.2~v0.4 로 식별된 갭(자동 포맷/린트, AUTO-MANAGED, 4-Phase 명문화, GC 센서, 리뷰 서브에이전트, 전용 MCP, worktree)을 **모두 보완**했다. 남은 것은 advanced/검토 대상(의미 센서, CI 자동 AUTO-MANAGED 갱신)뿐이며 현 규모(1인 저볼륨)에선 현행 유지가 적절하다.
