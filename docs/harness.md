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

### 3. 통합 테스트가 개발 데이터와 충돌 (전역 카운트 깨짐)
**증상**: 브라우저로 글을 몇 개 만든 뒤 `pnpm --filter api test` 실행 →
`total` 단언 등이 갑자기 실패. 또는 테스트가 운영자 시드/샘플 데이터를 지워버림.

**원인**: 통합 테스트가 **개발 DB(`blog`)를 그대로 사용**. 테스트는 author 기준으로만 정리하는데
`listForAdmin`/`listPublished` 의 `count()` 는 전역이라, 개발용으로 만든 데이터가 카운트에 섞인다.

**해결(적용됨)**: 테스트는 **전용 DB `blog_test`** 를 쓴다.
- `init.sh` 가 `blog_test` 생성 + 마이그레이션을 자동 처리.
- `src/test-db.setup.ts`(unit) / `test/jest-e2e.setup.ts`(e2e) 가 `DATABASE_URL` 을 `blog_test` 로 **강제**.
- 따라서 테스트는 개발 데이터를 절대 건드리지 않고 전역 카운트도 결정적이다.
- 새 통합 spec 은 `process.env.DATABASE_URL ??= ...` 같은 자체 기본값을 두지 말 것(setup 이 강제함).

### 5. Playwright E2E 가 공유 dev DB 를 더럽힘 → 격리 스택으로 분리
**증상**: T-WEB-008 까지의 Playwright E2E 는 dev 스택(blog DB, 5433)에 직접 붙어 돌았다.
- 운영자 글이 dev 데이터 위에 쌓이고 발행 목록/전역 카운트가 흔들렸다.
- dev 작업 중이면 E2E 를 돌릴 수 없고, 반대로 E2E 가 dev 샘플을 회복 불가하게 바꿀 수 있었다.

**원인**: jest 통합 테스트는 `blog_test` 로 격리되어 있는데(함정 #3) Playwright 만 dev DB 를 그대로 썼다.

**해결(T-INFRA-005, 적용됨)**: 3-tier DB 격리.

| 트랙 | DB | 포트 | 트리거 |
|---|---|---|---|
| 개발 (사람) | `blog` | 5433 | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` |
| jest 통합 테스트 | `blog_test` | 5433 | `pnpm --filter api test` (setup 이 DATABASE_URL 강제) |
| Playwright E2E | `blog_e2e` | **5434** | `pnpm --filter web test:e2e` |

**파일**:
- `docker-compose.e2e.yml` — 격리 db(5434) / api(3002) / web(5174) **prod 빌드**. 별도 프로젝트 이름 `my-blog-e2e` 사용 → 컨테이너·네트워크·볼륨 충돌 0. db 는 `tmpfs` 로 매 실행 새 데이터.
- `scripts/e2e-isolated.sh` — 한 명령(`pnpm --filter web test:e2e`)으로:
  chromium 보장 → 격리 db up + healthy → prisma migrate deploy → 운영자 시드 →
  api/web up + healthy → Playwright 실행 → dev DB 카운트 비교 → 자동 `down -v`.
- `.env.example` — `E2E_DB_PORT/E2E_API_PORT/E2E_WEB_PORT/E2E_OPERATOR_*/E2E_JWT_SECRET` 등.

**격리 회귀 가드**: 스크립트가 실행 전/후로 dev DB 의 `(posts:comments)` 카운트를 비교해
다르면 비0 종료한다. T-INFRA-005 검증 중 임시 sentinel `(1:0)` 행을 dev 에 넣고 격리 E2E 를
돌렸을 때, after 도 `(1:0)` 로 변동 0 → 가드가 진짜로 보호함을 확인 후 sentinel 제거.

**디버깅 옵션**: `E2E_KEEP_STACK=1 pnpm --filter web test:e2e` 로 종료 시 `down -v` 를 생략.
컨테이너 로그/DB 를 직접 확인한 뒤 수동 정리:
```
docker compose -f docker-compose.e2e.yml -p my-blog-e2e down -v
```

**부수 발견 — prod 빌드 버그 동시 수정**: `packages/api/Dockerfile` 의 `CMD ["node", "dist/main"]` 은
`nest build` 산출 경로(`dist/src/main.js`)와 맞지 않아 prod 이미지가 부팅 즉시
`Cannot find module '/repo/packages/api/dist/main'` 으로 죽었다. 격리 스택의 첫 실행이 이 버그를
표면화시켜 같이 수정(`dist/src/main`). 운영 첫 배포가 동일하게 깨질 뻔한 사전 보증.

### 4. 업로드 이미지가 깨져 보임 — 저장만 하고 서빙 경로를 안 맞춤
**증상**: 글에 올린 이미지가 브라우저에서 깨진 아이콘으로 보인다.
`GET /uploads/<file>` 이 200 처럼 보여도 `Content-Type: text/html`(SPA fallback)을 반환한다.

**원인**: 업로드는 파일을 디스크에 **저장**만 했고, 그 파일을 다시 **HTTP 로 서빙하는 경로**가 빠졌다.
정적 리소스가 브라우저에 닿으려면 **세 곳**이 한 베이스(`/uploads`)로 정합해야 한다:
1. **API 정적 서빙** — `configureApp` 의 `useStaticAssets(UPLOAD_DIR, { prefix: UPLOAD_URL_BASE })`
   (저장 경로/베이스는 `LocalStorageProvider` 와 동일해야 함).
2. **dev 프록시** — `packages/web/vite.config.ts` 의 `proxy['/uploads']` (없으면 Vite 가 index.html 폴백).
3. **prod 프록시** — `packages/web/nginx.conf` 의 `location /uploads/ { proxy_pass http://api:3000; }`.

**해결/예방**:
- 파일·정적 리소스를 반환하는 기능은 **반환 URL 이 실제 200 + 올바른 Content-Type 으로 서빙되는지**까지
  테스트로 검증한다(쓰기-읽기 왕복). 단위/통합에서 "URL 형식"만 보면 이 공백을 못 잡는다.
  - 적용됨: `test/upload.e2e-spec.ts` — 업로드 후 반환 URL 을 `GET` 해 200 + 동일 바이트 확인.
  - 적용됨: `packages/web/e2e/operator-flow.spec.ts` — 발행 글 상세에서 `img.naturalWidth > 0` 확인.
- **config/소스 변경 후 컨테이너 미반영**: Windows 바인드 마운트에서는 `nest --watch`/Vite 가 변경을
  못 잡는 경우가 있다. 정적 서빙·프록시 같은 부트스트랩 설정을 바꿨으면 `docker restart <svc>` 로
  강제 재기동 후 검증한다. (의존성 변경은 함정 #1 의 `--renew-anon-volumes` 를 쓴다.)

## 관련 파일

- `init.sh` — 환경 부트스트랩(개발 DB + 테스트 DB)
- `feature_list.json` — 진행 상태 정규 소스
- `CLAUDE.md` — 시작 루틴·완료 규칙·절대 규칙
- `.claude/commands/` — `ready` · `implement` · `finish` · 설계 명령들
- `.claude/hooks/` — `protect-paths` · `tdd-reminder` · `session-ready` · `verify-done-tasks`
- `docs/handoff/` — 세션 간 인계 노트
