# ADR-0014: CI 파이프라인 — GitHub Actions, 2-job 분리

## 상태 (Status)

Accepted - 2026-06-02

## 컨텍스트 (Context)

`feature_list.json` 의 31개 태스크가 모두 done 인 시점까지, 검증 게이트(lint / typecheck /
unit test / integration test / Playwright E2E)는 사람이 로컬에서 수동 실행해 왔다. T-INFRA-005
에서 격리 E2E 가 한 명령(`pnpm --filter web test:e2e`)으로 압축된 직후라, 같은 게이트를 **모든
PR 과 main 푸시**에 자동으로 거는 외부 회수기(외부 CI)를 도입할 시점이다.

평가 기준: 게이트 충실도, 실행 시간 캐시, 설정 복잡도, 이식성, 무료 한도, 우리 워크플로(슬래시
명령·핸드오프)와의 마찰.

후보:

- **GitHub Actions** — 저장소와 같은 호스트, YAML 1개로 시작 가능, public 저장소 무한 분, Postgres
  service container · Docker buildx · Playwright 공식 액션이 모두 1급 지원.
- CircleCI / GitLab CI — 유사 능력이나 별도 계정/통합 필요, 무료 한도 더 제한적.
- 자체 호스팅 (예: Drone, self-hosted runner) — 인프라 비용·관리 추가, MVP 규모에 과잉.

게이트 분리 후보:

- 단일 job 전부 순차 — 단순하나 web-e2e 가 실패하면 빠른 피드백 손해.
- job per package (web/api 각각) — 병렬은 좋지만 통합 e2e 처럼 둘 다 필요한 케이스가 어색.
- **2 job: quality(필수 게이트 묶음) + web-e2e(격리 스택)** — Postgres service 한 번에 묶고
  Docker 가 필요한 무거운 트랙만 분리.

## 결정 (Decision)

`.github/workflows/ci.yml` 한 파일에 **GitHub Actions** 워크플로를 둔다. 트리거는 `pull_request`
와 `push: main`. 두 개의 job 으로 나눈다.

### Job `quality` (Ubuntu, Postgres service)

- pnpm + Node setup (캐시: pnpm store)
- 워크스페이스 전체 `pnpm install --frozen-lockfile`
- 단계: web lint / web typecheck / web vitest / api lint / api jest unit / api jest e2e
- DB 는 service container 의 Postgres + `blog_test` 강제 (jest setup 이 보장)
- Prisma generate + migrate 는 setup step 에서 실행

### Job `web-e2e` (Ubuntu, Docker)

- pnpm install
- Playwright 브라우저 캐시(`~/.cache/ms-playwright`)
- `pnpm --filter web test:e2e` 호출 → `scripts/e2e-isolated.sh` 가 격리 스택을 띄우고
  3 스펙을 통과시키고 자동 정리
- 실패 시 `playwright-report/` · `test-results/` 를 actions/upload-artifact 로 보존

두 job 은 병렬 실행하되, **둘 다 통과해야 PR 머지 가능**(브랜치 보호의 required status checks).

캐시 정책: pnpm store · Playwright browsers · Docker buildx layer. 첫 실행은 5~7분, 캐시 적중
시 ≤ 3분 목표.

## 결과 (Consequences)

긍정:

- 매 PR 에서 31개 게이트(web lint/tc/test 32 + api lint/test 45 + api e2e 35 + Playwright 3
  = 카운트 합 ~115건)가 자동 보장된다.
- 격리 E2E 스크립트(T-INFRA-005)를 CI 가 그대로 호출 — 로컬과 CI 가 같은 한 경로를 공유,
  "내 PC 에서만 통과"가 사라진다.
- 실패 시 Playwright trace/screenshot/video 가 artifact 로 남아 사후 디버깅 가능.
- 외부 인프라 0 추가 — 저장소만으로 운영.

부정 / 감수해야 할 것:

- Docker 빌드(특히 web-e2e job 의 격리 스택 prod 빌드) 캐시 미적중 시 분 단위 지연.
- public/private 전환 시 분당 과금 정책 차이 — 현재는 public 무료 한도로 충분.
- Playwright 의존(브라우저 다운로드)은 캐시로 흡수하지만 메이저 업데이트마다 캐시 무효화.
- Postgres service container 는 매 job 새로 띄움 — 마이그레이션 시간이 매번 가산.

## 검토 시점

- 빌드/테스트 합산 시간이 10 분을 넘는 시점 → matrix split 또는 nightly 분리 재평가.
- 자체 호스팅 러너가 비용/성능 면에서 의미를 가지는 시점.
- 다른 게이트(코드 커버리지 임계, dependency audit, container image scan) 추가가 필요해질 때.
