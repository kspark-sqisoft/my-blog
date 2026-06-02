# my-blog 개발 하네스 — 무엇이 가능해졌나

이 문서는 `init.sh`, `feature_list.json`, 슬래시 명령, Hooks 로 구성된 **개발 하네스**가
무엇을 자동화하고, 그래서 실제로 무엇이 달라졌는지를 설명한다.

## 한 줄 요약

> 예전엔 매 단계를 사람이 직접 시켜야 했다. 이제는 **"준비"** 한 마디면 같은 워크플로가 자동으로 굴러가고,
> 규칙은 "Claude가 잘 따라주길 바라는 것"에서 **"기계가 강제하는 것"** 으로 바뀌었다.

---

## Before / After

| 상황 | Before (수동) | After (하네스) |
|---|---|---|
| 세션 시작 | 사용자가 "환경 띄워줘 → handoff 읽어 → 다음 뭐 하지?"를 매번 지시 | **"준비"** 한 마디 → init.sh·handoff·git log·다음 태스크 선택까지 자동, 확인만 |
| 다음 작업 선택 | 사람이 tasks.md 훑어보며 판단 | `feature_list.json` 에서 deps 충족·최고 우선순위 1개 자동 계산 |
| 진행 상태 | Claude가 .md 를 멋대로 고쳐 헷갈림 | 상태는 **JSON 정규 소스**, 변경은 `/finish` 만 |
| 태스크 완료 | "검증 돌려줘 → handoff 써줘 → 커밋해줘" 3번 지시 | `/finish {ID}` 한 명령 |
| 규칙 위반 | "그러면 안 되는데…" 사후 발견 | Pre/Stop **Hook 이 실행 시점에 차단** |
| TDD 누락 | 깜빡하고 구현부터 | UserPromptSubmit 훅이 RED→GREEN 리마인드 |

---

## 구성 요소

### 1. `init.sh` — 환경 1커맨드 부트스트랩
`bash init.sh` 하나로 환경을 정상화하고, 실패하면 즉시 비0 종료한다.

- 필수 도구(node/pnpm/docker) 확인
- 워크스페이스 의존성 설치(필요 시)
- PostgreSQL 컨테이너 기동 + **healthy 대기**
- Prisma 클라이언트 생성 + 마이그레이션 적용
- 마지막에 주요 명령(개발/검증/시드)을 안내

→ "내 PC에서 환경이 어떻더라"를 없앤다. 누구든 같은 한 줄로 동일한 상태가 된다.

### 2. `feature_list.json` — 진행 상태의 정규 소스
사람이 읽는 `docs/tasks/blog-mvp.md` 와 별개로, **상태만 구조화된 JSON** 으로 둔다.

- 모델은 자유 서술 마크다운보다 JSON 을 임의 수정하는 빈도가 낮다 → 진행 상태가 안 흔들린다.
- 각 태스크: `id, title, epic, priority, deps[], status, completed_at, acceptance[]`.
- "다음 태스크 = status:todo · deps 전부 done · priority 최소" 를 코드로 계산할 수 있다.

### 3. 슬래시 명령 — 워크플로를 명령 하나로
- `/ready` : 세션 시작 루틴(아래 5단계)을 실행.
- `/implement {ID}` : 한 태스크를 TDD(Red→Green→Refactor)로 구현.
- `/finish {ID}` : 완료 마감 — 검증 재실행 → acceptance 점검 → feature_list 갱신 → handoff 작성 → commit.
- (설계 단계) `/glossary` `/prd` `/bc` `/trd` `/adr` `/tasks`.

### 4. Hooks — 규칙의 기계적 강제
신뢰가 아니라 **실행 시점의 차단/주입**으로 규칙을 강제한다.

| 이벤트 | 훅 | 강제하는 것 |
|---|---|---|
| PreToolUse(Edit\|Write) | `protect-paths` | `.env`·확정(Accepted) ADR 수정 **차단(exit 2)** |
| UserPromptSubmit | `tdd-reminder` | 구현 의도면 RED→GREEN→REFACTOR 리마인드 |
| UserPromptSubmit | `session-ready` | "준비"/`/ready` 면 시작 루틴 주입 |
| Stop | `verify-done-tasks` | 미커밋 `status=done`(MD+JSON) 감지 시 검증·커밋 유도 |

---

## 매 세션 시작 루틴 ("준비" 한 마디)

1. `bash init.sh` — 환경 점검. 실패하면 멈추고 보고.
2. `docs/handoff/` 최신 1개 읽기 — 직전 세션 컨텍스트 복원.
3. `git log --oneline -10` — 최근 변경 확인.
4. `feature_list.json` 에서 다음 태스크 후보 결정.
5. 후보의 **ID + acceptance 만** 보여주고 **멈춤** — 사용자 확인 전 구현 금지.

→ 새 세션에서 사용자가 거의 입력하지 않아도, 항상 같은 출발선에서 같은 순서로 일이 시작된다.

## 한 태스크의 수명주기

```
준비 → (확인) → /implement {ID}        → /finish {ID}
        ↑            Red→Green→Refactor      검증·acceptance·feature_list·handoff·commit
        └ feature_list.json 가 다음 후보를 계산
```

---

## 그래서 무엇이 가능해졌나

- **무지시 시작**: "준비" 한 마디로 환경·컨텍스트·다음 작업이 자동 정렬된다.
- **흔들리지 않는 진행 상태**: 상태는 JSON 정규 소스 + `/finish` 단일 경로로만 바뀐다.
- **컨텍스트 단절 없는 인계**: handoff 가 자동 작성·커밋되어 다음 세션이 바로 이어간다.
- **검증 없는 완료 불가**: Stop 훅이 미검증 done 을 막아, "거의 다 됐다"식 보고가 구조적으로 차단된다.
- **돌이킬 수 없는 실수 예방**: `.env`·확정 ADR 수정이 도구 실행 전에 차단된다.
- **재현 가능성**: 누구의 PC에서든 `init.sh` 한 줄로 동일 환경, 동일 워크플로.

## 운영 함정 & 해결 (겪은 것 기록)

### 1. Docker dev — 호스트에서 추가한 의존성이 컨테이너에 안 보임
**증상**: 호스트에서 `pnpm --filter web add X` 후 브라우저에
`Failed to resolve import "X"` (Vite). 컨테이너 안 `/repo/.../X` 없음.

**원인**: dev 컨테이너의 `node_modules` 는 **익명 볼륨**이라 이미지 빌드 시점 내용으로 고정됨.
호스트 설치는 호스트 `node_modules`·lockfile 만 바꾸므로 컨테이너에 반영되지 않는다.

**해결**: 의존성을 바꾼 뒤 이미지 재빌드 + 익명 볼륨 갱신.
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes
```
`--build` 가 새 lockfile 로 install, `--renew-anon-volumes` 가 컨테이너 node_modules 를 새로 만든다.
db 는 named 볼륨(`db-data`)이라 데이터는 보존된다.

### 2. 한글(비ASCII) 데이터가 ���로 깨짐
**증상**: 목록/상세에 제목이 `efbfbd`(� U+FFFD) 덩어리로 보임.

**원인**: **Windows Git Bash 의 `curl -d '{"title":"한글"}'`** 에서 한글이 잘못 인코딩되어
API 에 깨진 바이트로 도달 → DB 에 그대로 저장(복구 불가).

**해결/예방**: 셸에서 비ASCII 본문을 직접 넣지 말 것.
- Node 스크립트의 `fetch` 사용(소스 파일이 UTF-8 이라 안전), 또는
- JSON 을 UTF-8 파일로 저장 후 `curl -d @payload.json`, 또는
- 실제 UI(브라우저 폼)로 입력.
이미 깨진 행은 삭제 후 재생성한다.

## 관련 파일

- `init.sh` — 환경 부트스트랩
- `feature_list.json` — 진행 상태 정규 소스
- `CLAUDE.md` — 시작 루틴·완료 규칙·절대 규칙
- `.claude/commands/` — `ready` · `implement` · `finish` · 설계 명령들
- `.claude/hooks/` — `protect-paths` · `tdd-reminder` · `session-ready` · `verify-done-tasks`
- `docs/handoff/` — 세션 간 인계 노트
