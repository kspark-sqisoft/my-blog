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
| PostToolUse(Edit\|Write) | `docker-rebuild-sensor` | 도커 재빌드 트리거(deps/Dockerfile/compose/.env) 감지 → 정확한 명령 알림 + sentinel 기록(비차단) |
| PostToolUse(Edit\|Write) | `shared-build` | `packages/shared/src/**` 편집 시 `@blog/shared` 자동 재빌드(dist 최신화, 비차단) |
| PostToolUse(Edit\|Write) | `worktree-guard` | default 브랜치(main) 메인 체크아웃에서 기능 소스 첫 편집 시 worktree 사용 권유(세션당 1회, 비차단) |
| UserPromptSubmit | `tdd-reminder` | 구현 의도면 RED→GREEN→REFACTOR 리마인드 |
| UserPromptSubmit | `session-ready` | "준비"/`/ready` 면 시작 루틴 주입 |
| Stop | `verify-done-tasks` | 미커밋 `status=done`(MD+JSON) 감지 시 검증·커밋 유도 |
| Stop | `review-gate` | 세션 내 기능 소스 수정+커밋했는데 `code-reviewer` 미경유 시 1회 차단(self-approve 금지 강제) |
| Stop | `docker-rebuild-stop` | `AUTO_DOCKER_REBUILD=1` 일 때만 펜딩 재빌드 자동 수행 유도(옵트인) |

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
  못 잡는 경우가 있다. 부트스트랩 설정뿐 아니라 **일반 서비스 로직 변경(예: DTO 매핑에 필드 추가)** 도
  watch 가 놓칠 수 있다 — API 응답이 기대대로 안 바뀌면 먼저 라이브 응답을 `curl` 로 확인하고
  `docker restart <svc>`(예: `docker restart my-blog-api-1`) 로 재컴파일·재기동한 뒤 검증한다.
  (의존성 변경은 함정 #1 의 `--renew-anon-volumes` 를 쓴다.)

### 6. 도커 재빌드를 깜빡함 — 트리거 감지 센서로 자동화
**증상**: `package.json`/`Dockerfile`/`docker-compose*.yml`/`.env` 를 고쳤는데 dev 컨테이너에 반영이 안 됨.
핫리로드(소스/엔티티/DB)에 익숙해진 나머지, **재빌드가 필요한 변경**까지 "알아서 반영되겠지" 하고 넘어간다.

**원인**: dev 스택은 소스만 바인드 마운트한다. 의존성은 이미지 빌드 시점(익명 볼륨)에, Dockerfile/compose/.env 는
컨테이너 생성 시점에 고정된다 — 이 파일들은 **재빌드(또는 재생성)** 해야만 반영된다.

**해결(적용됨)**: 편집 도구 후킹으로 감지 + 옵트인 자동 실행. (설계 결정: 재빌드는 실행 중 서비스를
내렸다 올리는 무거운 작업이라 "감지 즉시 무조건 실행"은 편집 중 thrash·예고 없는 재기동 위험 → 기본은 알림,
실행은 옵트인.)

| 바뀐 것 | 분류 | 명령 |
|---|---|---|
| `package.json` / `pnpm-lock.yaml` | deps | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --renew-anon-volumes` |
| `Dockerfile(.*)` / `docker-compose.yml` / `docker-compose.dev.yml` / `.env` | config | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` |

- **`.claude/hooks/docker-rebuild-sensor.mjs`** (PostToolUse Edit\|Write, 비차단): 트리거 파일 변경을 감지해
  정확한 명령을 Claude 컨텍스트에 주입하고, 펜딩을 `.claude/.docker-dirty.json`(gitignore)에 기록한다.
  deps 가 config 보다 강하다(한 번 deps 면 `--renew-anon-volumes` 명령 유지). dev 스택과 무관한
  `docker-compose.e2e.yml`/`.prod.yml`, `node_modules/**` 는 트리거에서 제외. `.env` 는 protect-paths 가
  Edit 를 막으므로 실질적으로 사람이 직접 고치며, 그 경우 이 알림은 안 뜬다 — 수동 재빌드를 기억할 것.
- **`.claude/hooks/docker-rebuild-stop.mjs`** (Stop, 옵트인): `AUTO_DOCKER_REBUILD=1` 일 때만, sentinel 이
  있으면 턴 종료 시 재빌드 실행을 지시한다(`decision: block`). Bash 로 실행을 위임해 빌드 로그가 세션에
  보이고 healthy 확인까지 검증되며, 성공 후 sentinel 을 지우면 다음 종료는 자동 통과한다. `stop_hook_active`
  가드로 무한 루프를 막는다. env 미설정이면 아무 것도 하지 않는다(알림은 이미 센서가 했다).

**왜 핫리로드는 트리거가 아닌가**: dev 오버라이드가 소스를 바인드 마운트하고 `CHOKIDAR_USEPOLLING`/
`VITE_USE_POLLING` 으로 폴링하므로 `.ts/.tsx` 저장은 재컴파일된다. Prisma 엔티티는 `migrate` 로, DB 데이터는
런타임 쿼리로 반영된다 — 모두 재빌드 불필요. (단 함정 #4 처럼 Windows 바인드 마운트에서 watch 가 변경을
놓치면 `docker restart <svc>` 로 개별 재기동한다 — 이건 재빌드가 아니라 재시작이다.)

### 7. 같은 워킹트리 동시 작업 → 파일 덮어쓰기 (worktree-guard 안내)
**증상**: 두 세션(또는 두 작업)이 같은 워킹트리에서 같은 파일을 동시에 고치면, 한쪽 저장이 다른 쪽을
덮어쓰거나 커밋 시 머지 충돌이 난다. (참여(C)·읽기경험(B)을 동시에 진행할 때 `PostDetail.tsx` 가 겹쳐
실제로 충돌을 해결해야 했다 — 격리 worktree 로 분리해 사고를 피했다.)

**원인**: 한 디렉터리를 두 작업이 공유하면 파일시스템 수준에서 서로의 변경을 보호할 수 없다.

**해결(적용됨, 안내형)**: `.claude/hooks/worktree-guard.mjs` (PostToolUse Edit|Write, **비차단**).
default 브랜치(`main`)의 **메인 체크아웃**에서 **기능 소스**(`packages/{api,web,shared}/src/**`,
`prisma/schema.prisma`)를 편집하면, 격리 worktree 사용을 **세션당 1회** 권유한다(차단하지 않음 —
단발 핫픽스·문서 수정까지 막으면 번거로우므로). 판정:
- 링크된 worktree(`git-dir != git-common-dir`)면 이미 격리 → 안내 안 함.
- 메인 체크아웃이라도 별도 브랜치면 → 안내 안 함(브랜치도 격리).
- `main` + 메인 체크아웃 + 기능 소스 → 1회 안내(EnterWorktree 또는 `scripts/worktree-new.sh`).
- "1회"는 `.claude/.worktree-guard-warned` sentinel(gitignore)로 관리하고, `session-start` 가 매 세션
  시작에 지워 새 세션마다 다시 안내한다.

**worktree 작업 시 함정(함정 #6 연계)**: dev Docker 스택은 **메인 디렉터리** 소스를 바인드 마운트하므로,
worktree 편집은 핫리로드로 안 보인다. worktree 에서는 TDD(jest/vitest)로 검증하고, 브라우저 도그푸딩은
메인 디렉터리에서 한다. worktree 에서 `init.sh` 의 `docker compose up -d db` 는 호스트 5433 포트가 메인
db 와 충돌하니, **메인 db(5433)를 재사용**(prisma generate + migrate deploy 만)하면 된다.

### 8. shared 소스만 바뀌고 dist 가 stale → api 컴파일 깨짐(502)
**증상**: shared 변경(merge·pull·편집) 후 dev 스택을 올리면 web 목록이 "불러오지 못했습니다" + `/api` 502.
api 로그에 `Module '"@blog/shared"' has no exported member 'X'` / `'Y' does not exist in type 'PostSummaryDto'`
류 TS 에러 다수 → `nest start --watch` 가 컴파일에 실패해 서버를 띄우지 못함 → vite 프록시가 502.

**원인**: api(NestJS·CJS)와 api 의 jest 는 `@blog/shared` 를 **빌드 산출물 `packages/shared/dist`** 로
해석한다(package.json `require`→`dist/index.js`, `types`→`dist/index.d.ts`). web(Vite·ESM)은 `exports.import`
→ `src/index.ts` 를 직접 본다. 그래서 shared **소스만** 바뀌고 dist 를 재빌드하지 않으면 **api 만** 깨지고
web 은 멀쩡하다(혼동 포인트). `dist` 는 gitignore 라 커밋·머지로 갱신되지 않는다 — **반드시 빌드해야** 갱신된다.
(실제 사례: 참여(C) 머지 후 `up --build` → 메인 dist 가 참여 이전 버전이라 api 6에러로 502. shared 재빌드 +
api 재기동으로 해소.)

**해결(적용됨, 3중 자동화)**:
- **dev 컨테이너**: `docker-compose.dev.yml` 의 api command 가 `pnpm --filter @blog/shared run build` 를
  먼저 실행한다(매 기동마다 dist 최신화). → compose 변경이라 적용하려면 api 컨테이너 재생성 필요
  (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`).
- **부트스트랩**: `init.sh` 의 `2-b` 단계가 매번 shared 를 빌드.
- **세션 중**: `.claude/hooks/shared-build.mjs`(PostToolUse) 가 `packages/shared/src/**` 편집 시 자동 재빌드.
- 수동: `pnpm --filter @blog/shared run build`.

**watch 가 dist 변경을 못 잡을 때**: Windows 바인드 마운트에서 node_modules 경유 `.d.ts` 변경은 nest watch 가
놓칠 수 있다(함정 #4). 이미 떠 있는 컨테이너라면 `docker restart my-blog-api-1` 로 클린 재컴파일한다.

### 9. @blog/shared 에 런타임 의존(zod 등)을 넣어 prod api 부팅 크래시
**증상**: 로컬 dev·CI 단위테스트는 다 통과하는데, **격리 e2e / prod 배포**에서만 api 컨테이너가 기동 직후
`exited(1)`. 로그: `Error: MODULE_NOT_FOUND ... at packages/shared/dist/dto/*.js ... require('zod')`,
requireStack 이 `shared/index.js → api/dist/.../app.module.js → main.js`. (2026-06-08 사고 — 프로필 기능에서
`updateProfileSchema`(zod)를 shared 에 넣고 index 가 값으로 re-export.)

**원인**: `@blog/shared` 는 **순수 타입 + 손수 작성 상수**만 두는 패키지로 `dependencies` 가 비어 있다.
zod 같은 **라이브러리 값**을 shared 에 두고 `export` 하면, 그 값을 import 하는 모든 소비자(특히 prod api)가
부팅 시 그 라이브러리를 강제 `require` 한다. shared 가 의존을 선언 안 해 **prod 이미지엔 없으므로 크래시**.
dev/CI 단위테스트는 **모노레포 호이스팅**으로 zod 가 우연히 보여 통과 → prod/격리 스택에서야 표면화(가장 음흉).
(web 은 src 를 ESM 으로 직접 봐서 영향 없음 — 또 혼동 포인트.)

**해결(적용됨)**: shared 는 타입만 두고, zod 폼 스키마는 **web**(`pages/Register.tsx` 처럼 로컬), 서버 검증은
**api class-validator** 로 분리(검증은 각 패키지, ADR-0004). 기계적 가드 추가:
- `tools/check-shared-purity.mjs` (`pnpm check:shared-purity`): `packages/shared/dist/**/*.js` 가 shared
  `dependencies` 에 없는 bare(외부) 모듈을 `require` 하면 **실패**. CI **quality 잡**에서 shared 빌드 직후 게이트.
- 정말 shared 런타임에 의존이 필요하면 `packages/shared/package.json` 의 `dependencies` 에 명시해야 가드를 통과한다.

**메타 교훈(디버깅)**: 위 사고 직전 CI 실패를 로그 없이 추측 패치해 두 번 헛짚었다. **CI/prod 실패는 추측 금지 —
step 결론·로그(또는 격리 prod 스택 로컬 재현)로 근본원인을 확정한 뒤 하나씩 고친다**(systematic-debugging).
같은 세션에 CI 실패는 사실 4겹이었다: ①pnpm/action-setup 버전 충돌 ②CI shared 빌드 누락 ③테스트 DB 포트
(5433↔CI 5432, `TEST_DATABASE_URL` 미지정) ④이 항목(shared 런타임 zod). 앞 3개는 잠복 CI 설정 결함, ④는 신규 버그.

## 관련 파일

- `init.sh` — 환경 부트스트랩(개발 DB + 테스트 DB + @blog/shared 빌드)
- `tools/check-shared-purity.mjs` — `@blog/shared` 런타임 순수성 가드(`pnpm check:shared-purity`, CI 게이트, 함정 #9)
- `feature_list.json` — 진행 상태 정규 소스
- `CLAUDE.md` — 시작 루틴·완료 규칙·절대 규칙
- `.claude/commands/` — `ready` · `implement` · `finish` · 설계 명령들
- `.claude/hooks/` — `protect-paths` · `tdd-reminder` · `session-ready` · `verify-done-tasks` · `review-gate` · `docker-rebuild-sensor` · `docker-rebuild-stop` · `worktree-guard` · `shared-build`
- `docs/handoff/` — 세션 간 인계 노트
- `docs/harness-gap-analysis.md` — 가이드(claude-code-guide) 대비 하네스 갭/보강 권고
- `docs/harness-changelog.md` — 하네스 자체 변경 이력(가이드 12.5)
- `.claude/hooks/format-edited.mjs` — 편집 후 자동 포맷/린트(PostToolUse, 가이드 12 STEP5)
- `.claude/agents/{code-reviewer,verifier,plan-critic,debugger}.md` — 프로젝트 규칙 내장 서브에이전트(코드 리뷰·acceptance 검증·기획 검토·디버깅). 범용 설계·디자인은 글로벌(OMC·superpowers·gstack)을 호출(CLAUDE.md "설계·디자인 보조" 표)
- `knip.json` / `.jscpd.json` — 가비지 컬렉션 센서(미사용·중복, `pnpm gc`)
- `tools/mcp/prisma-helper/` — 전용 MCP 가드 툴(인덱스/마이그레이션/PII), 루트 `.mcp.json` 등록
- `scripts/worktree-new.sh` — 격리 worktree 생성 헬퍼(가이드 12.8)
