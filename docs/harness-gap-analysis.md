# 하네스 갭 분석 — 가이드 대비 보강

> 기준 문서: `docs/claude-code-guide/claude_code_guide.pdf` (특히 **11장 10-Phase 워크플로우**, **12장 Harness Engineering STEP 1-6**, 7장 Hooks, 16장 Verification).
> 목적: 우리 프로젝트 하네스(`.claude/**`, `init.sh`, `CLAUDE.md`, `feature_list.json`, `docs/`)가 가이드 권고를 얼마나 따르는지 점검하고 보완점을 정리한다.
> 변경 이력은 `docs/harness-changelog.md`.

## 1. 현황 매트릭스 (가이드 메커니즘 → 우리 보유 여부)

| # | 가이드 메커니즘 | 근거(장) | 우리 상태 | 비고 |
|---|---|---|---|---|
| 1 | `init.sh` 1커맨드 부트스트랩 + 헬스체크 | 12 STEP1 | ✅ 보유 | `init.sh` |
| 2 | `feature_list.json` 진행 상태 정규 소스 | 12 STEP3 | ✅ 보유 | 35개 태스크 |
| 3 | Phase별 슬래시 명령(/prd~/finish) | 11 | ✅ 보유 | `.claude/commands/` 9종 |
| 4 | `tdd-feature` 스킬(Red-Green-Refactor 강제) | 12 STEP6 | ✅ 보유 | description 자동 트리거 |
| 5 | 세션 시작 루틴 훅("준비") | 12 STEP2 | ✅ 보유 | `session-ready.mjs` + `/ready` |
| 6 | 보호 경로 훅(.env/ADR/migrations) | 7, 12 STEP5 | ✅ 보유 | `protect-paths.mjs`(PreToolUse — 가이드보다 강함, 쓰기 전 차단) |
| 7 | 검증 없는 done 차단(Stop 훅) | 12 STEP5, 16 | ✅ 보유 | `verify-done-tasks.mjs` |
| 8 | DDD/ADR/handoff 문서 환류 | 11 P1·3·5·10 | ✅ 보유 | glossary/bc/adr/handoff |
| 9 | **편집 후 자동 포맷/린트 훅(PostToolUse)** | 7, 12 STEP5 | ✅ **추가됨(v0.2)** | 이전엔 공백 → `format-edited.mjs` |
| 10 | **CLAUDE.md AUTO-MANAGED 구간(코드 파생)** | 12.7 | ✅ **추가됨(v0.2)** | 엔드포인트 표 + /finish 갱신 |
| 11 | **하네스 changelog(버전·진화 기록)** | 12.5 | ✅ **추가됨(v0.2)** | `docs/harness-changelog.md` |
| 12 | 지속적 가비지 컬렉션(unused/중복 감지) | 12.5 | ⚠️ 미보유 | knip/ts-prune/jscpd → 권고 P2 |
| 13 | 전용 리뷰 패스(code-reviewer/debugger 서브에이전트) | 6 | ⚠️ 부분 | OMC 전역 에이전트는 있으나 프로젝트 `.claude/agents/` 없음 → 권고 P2 |
| 14 | git worktree 병렬·격리 작업 | 12.8 | ⚠️ 미보유 | 단일 작업 흐름 → 권고 P3 |
| 15 | 프로젝트 전용 MCP(스키마/PII 가드) | 8.5 | ⚠️ 미보유 | prisma-helper류 → 권고 P3 |
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

## 3. 남은 권고 (우선순위 · 비용 · 영향)

### P1 — 4-Phase 태스크 루프 명문화 (문서, 저비용)
- **왜**: 가이드 12.7 은 태스크 1건을 `① 이해+계획(plan) → ② 구현(TDD) → ③ 검증(lint/type/test+자기리뷰) → ④ 문서화(handoff)` 4단계 루프로 돈다. 우리 10-Phase 는 "기능" 단위라, "태스크 1건" 단위 루프가 암묵적이다.
- **어떻게**: `CLAUDE.md` 또는 `/implement` 에 4-Phase 루프를 1블록으로 명시(이미 `/implement`+`tdd-feature`+`verify-done-tasks` 가 메커니즘은 갖춤 — 말로만 고정하면 됨).
- **비용**: 문서 5분.

### P2 — 지속적 가비지 컬렉션 센서 (CI, 중간)
- **왜**: 가이드 12.5 — 에이전트는 코드를 "추가"에 강하고 "삭제"에 약하다. 미사용/중복이 누적된다.
- **어떻게**: `knip`(미사용 export/파일) + `ts-prune`, `jscpd`(중복) 를 CI 비차단 job 으로 추가하고 PR 코멘트. 임계 넘으면 경고.
- **비용**: 반나절(도구 설정 + CI job). ADR 불필요(도구 추가).

### P2 — 프로젝트 전용 리뷰 서브에이전트 (중간)
- **왜**: 가이드 6장 — 저자/리뷰어 분리(별도 컨텍스트). 현재 OMC 전역 에이전트에 의존하고 프로젝트엔 고정 리뷰 패스가 없다.
- **어떻게**: `.claude/agents/code-reviewer.md`(읽기 전용, git diff 기반 심각도 분류), `.claude/agents/debugger.md`(근본원인). `/finish` 검증 후 자동 호출 또는 권유.
- **비용**: 2~3시간.

### P3 — git worktree 병렬 작업 (advanced)
- **왜**: 가이드 12.8 — 기능 2~3개를 격리 worktree+DB 로 동시에. 단일 개발자 1트랙이면 당장 불필요.
- **어떻게**: `claude -w <name>`, worktree별 `POSTGRES_DB`(11.8 Docker dev 응용), prefix/`.gitignore`/CI fresh-clone 규칙.
- **비용**: 1일+. 동시 작업 수요 생길 때.

### P3 — 프로젝트 전용 MCP(스키마/PII 가드) (advanced)
- **왜**: 가이드 8.5 — Prisma 인덱스 점검·destructive 마이그레이션 경고·PII 로깅 스캔을 LLM 이 직접 호출 가능한 툴로. "절대 규칙 #9(서빙 왕복 검증)", "#8(테스트 DB)" 같은 우리 규칙을 기계 가드로 승격 가능.
- **어떻게**: FastMCP `prisma-helper`(`check_index`, `check_migration_destructive`, `scan_pii_logging`) → `.mcp.json` 등록.
- **비용**: 1일.

### 검토 대상 — Stop 검증을 의미(semantic) 센서로
- 가이드 12.4/16 은 "검증 센서가 사람 말이 아니라 LLM 이 보게" 한다(prompt 타입 Stop). 우리 `verify-done-tasks.mjs` 는 결정적(파일 존재/상태)이라 빠르고 견고하다. 굳이 prompt 로 바꾸지 말고 **결정적 가드 유지 + 필요 시 prompt 보조** 권장(현행 유지).

## 4. 의도적으로 채택하지 않은 것
- **Dynamic Workflows / Agent Teams 상시화**: 저볼륨 1인 블로그라 over-engineering(가이드도 "doom-loop 경계"). 명시 요청 시에만.
- **AUTO-MANAGED 자동(훅) 갱신**: 우선 `/finish` 수동 갱신으로 충분. 엔드포인트가 잦게 바뀌면 PostToolUse/Stop 자동화로 승격.

## 5. 한 줄 결론
핵심 루프(init→feature_list→TDD→검증 훅→handoff→commit)는 가이드와 정합한다. 이번에 **편집 후 자동 포맷/린트**, **AUTO-MANAGED 엔드포인트**, **하네스 changelog** 3개 공백을 메웠다. 다음 1순위는 **4-Phase 루프 명문화(문서)** 와 **가비지 컬렉션 센서(CI)** 다.
