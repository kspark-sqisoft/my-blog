# Handoff — author-by-default (T-AUTH-011, T-PUB-106)

날짜: 2026-06-04 / feature: author-by-default / 근거: ADR-0019

## 한 일
공개 회원가입 기본 역할을 `MEMBER` → **`AUTHOR`** 로 바꿔, 가입자가 운영자 승격 없이 가입 즉시
본인 글을 작성·발행·관리하게 했다(ADR-0019, ADR-0018 일부 갱신).

- **T-AUTH-011**: `AuthService.register`가 `role: 'AUTHOR'`로 생성. 클라이언트 role 지정 불가(화이트리스트) 유지.
  DB 컬럼 기본값은 `MEMBER` 유지(방어적 기본값, 마이그레이션 없음).
- **T-PUB-106**: `AdminPostController`를 `@Roles('AUTHOR','ADMIN')`로 개방. `PostService.listForAdmin`/`getForAdmin`이
  actor로 스코프 — ADMIN 전체, AUTHOR 본인 글만. 단건은 타인 글 403(없으면 404 우선).
- 문서: ADR-0019 신규, glossary(Member/회원가입), bounded-contexts(Auth) 갱신.
- e2e: `author-self-serve.spec.ts` 신규 — 가입→승격 없이→대시보드→작성→본인 발행→공개 상세 authorName.

## TDD 사이클 확인
- RED: auth.e2e(register→AUTHOR), post.service.spec(listForAdmin/getForAdmin actor 스코프),
  admin-posts.e2e(AUTHOR 본인만/타인 403) 먼저 작성·수정 → 실패.
- GREEN: register 역할 변경 + 서비스 스코프 + 컨트롤러 개방으로 통과.
- REFACTOR: actorOf 헬퍼를 admin-post.controller에 추가(post.controller와 동일 패턴).

## 결정한 것
- ADR-0019(Accepted): 기본 역할 AUTHOR, 운영자 목록 작성자 스코프, 스팸 대응은 기존 throttler 유지(이메일 인증 범위 외).
- `MEMBER`는 "강등된 독자"로 의미 재정의(역할 enum 3단계 유지).

## 알려진 이슈
- 대시보드 헤딩 "운영자 대시보드"가 일반 AUTHOR에게도 그대로 노출(문구만 어색, 기능 영향 없음 — ADR-0019 범위 외, 후속).
- 가입 즉시 쓰기 허용으로 스팸 표면 증가 → throttler에만 의존. 악용 시 모더레이션 도입 필요(별도 ADR).
- `member-journey.spec.ts`의 "MEMBER→AUTHOR 승격" 단계는 이제 사실상 no-op(기본이 AUTHOR)이나, 시나리오는 그대로 통과(ADMIN이 타 작성자 글 발행도 유효).

## 다음 세션이 알아야 할 것
- 가입자가 곧 작성자다. 작성자 본인 글 관리는 `/admin` 대시보드(스코프된 목록) + `/admin/posts/new`.
- 전체 글 조망/타 작성자 글 관리는 ADMIN만 가능.

## 명령 출력 증거
- `pnpm --filter api`(typecheck 0) / 단위 `Test Suites: 11 passed, Tests: 73 passed`
- API e2e `Test Suites: 10 passed, Tests: 54 passed`
- `pnpm --filter web` lint 0 / typecheck 0 / 단위 `Tests 55 passed`
- web e2e `5 passed`, dev DB 영향 없음
