# author-by-default — 공개 가입자 즉시 작성

> 정규 소스는 `feature_list.json`. 이 문서는 미러다(절대 규칙 #10).
> 근거: ADR-0019(공개 회원가입 기본 역할 AUTHOR, ADR-0018 일부 갱신).

## 배경
ADR-0018은 가입자를 글쓰기 불가 `MEMBER`로 만들고 운영자가 수동 승격해야 했다. 다중 작성자 블로그
운영 모델에 맞춰 **가입 즉시 본인 글을 쓰고 관리**하도록 기본 역할을 `AUTHOR`로 전환한다.

## 태스크

#### T-AUTH-011 — 공개 가입 기본 역할 AUTHOR
- priority: 48 / 의존: T-AUTH-009 / status: done (2026-06-04)
- acceptance:
  1. `POST /api/auth/register` → 기본 역할 AUTHOR (ADR-0019).
  2. 클라이언트 role 지정 불가(화이트리스트 400) 유지.
  3. DB 컬럼 기본값은 MEMBER 유지(방어적 기본값, 마이그레이션 없음).

#### T-PUB-106 — 운영자 Post 목록/상세 작성자 스코프
- priority: 49 / 의존: T-AUTH-011 / status: done (2026-06-04)
- acceptance:
  1. `GET /api/admin/posts`: AUTHOR 본인 글만, ADMIN 전체 (ADR-0019).
  2. `GET /api/admin/posts/:id`: 타인 글이면 403, 없으면 404 우선.
  3. `AdminPostController` `@Roles('AUTHOR','ADMIN')` 로 개방.

#### T-WEB-016 — 글 에디터 클라이언트 입력 검증
- priority: 50 / 의존: T-PUB-106 / status: done (2026-06-04)
- acceptance:
  1. 제목/본문이 비면 서버 400 전에 알림 배너를 띄우고 저장을 막는다.
  2. 빈 필드로 포커스 이동 + 깜빡임(blink) 시각 피드백.
  3. 공백만 입력한 제목도 검증으로 막는다.

## 범위 외
- 이메일 인증/가입 승인, 모더레이션(ADR-0019 범위 외).
- 대시보드 "운영자 대시보드" 헤딩 역할별 문구 정교화(후속).
