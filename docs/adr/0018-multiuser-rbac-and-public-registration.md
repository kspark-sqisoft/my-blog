# ADR-0018: 다중 사용자 회원가입 + 역할 기반 권한(RBAC)

## 상태 (Status)

Accepted - 2026-06-04

이 ADR은 **ADR-0002(운영자 계정 시드 부트스트랩, 공개 가입 없음)를 supersede** 한다. ADR-0002의 "공개 회원가입 없음" 결정은 본 ADR로 대체된다(시드 부트스트랩 자체는 최초 ADMIN 생성 용도로 유지).

## 컨텍스트 (Context)

blog-mvp는 운영자 1인 전제로 설계됐다: `User`에 역할이 없고(인증/비인증 2진), 계정은 시드로만 생성되며(ADR-0002), 댓글은 100% 익명이다. 이제 **여러 사용자가 가입·로그인하고, 운영자(슈퍼관리자)가 역할을 부여**하는 일반적인 블로그 운영 모델로 확장한다. ADR-0002는 이 확장 시 재평가를 명시했다.

결정해야 할 것: 역할 모델, 가입/승격 정책, JWT에 역할을 어떻게 반영할지(신선도), 권한 검사 위치, 댓글-계정 연결, 기존 계정/데이터 마이그레이션.

## 결정 (Decision)

### 1. 역할 모델 — 3단계 enum `UserRole`
- `ADMIN` — 슈퍼관리자(기존 운영자). 전체 글 관리 + 사용자/역할 관리.
- `AUTHOR` — 본인 글만 작성/수정/삭제/발행.
- `MEMBER` — 로그인 독자. 실명 댓글만(글 작성 불가).

`User.role`(NOT NULL, default `MEMBER`) 컬럼 추가. 마이그레이션 시점의 기존 행(시드 운영자뿐)은 `ADMIN`으로 백필.

### 2. 가입·승격 정책
- 공개 회원가입 `POST /api/auth/register` 제공 → 기본 역할 **MEMBER**(클라이언트가 role 지정 불가).
- 운영자가 `PATCH /api/admin/users/:id/role`로 **AUTHOR 승격**(및 강등). **마지막 ADMIN 강등/삭제는 금지**(트랜잭션 count 가드).

### 3. 역할 신선도 — JWT는 식별자만, 검증 시 DB 재조회
JWT payload는 `{sub, email}` 그대로 유지하고, `JwtStrategy.validate`에서 **매 요청 user를 DB 재조회**해 `{id, email, name, role}`를 구성한다. → 승격/강등이 토큰 만료(1h)를 기다리지 않고 **즉시 반영**되며, 토큰에 민감정보(역할)를 싣지 않는다. 삭제된 계정의 토큰은 401로 무효화된다. (PrismaModule이 `@Global`이라 추가 비용/배선 최소.)

### 4. 권한 검사 위치 — 역할은 가드, 소유권은 서비스
- **정적 역할 검사**: `@Roles(...)` 데코레이터 + `RolesGuard`(Reflector). `JwtAuthGuard`(인증) 다음에 실행.
- **리소스 소유권**(AUTHOR 본인 글): 리소스를 로드해야 판정 가능하므로 `PostService`가 actor`{id,role}`를 받아 검사(`ADMIN`은 전체, `AUTHOR`는 `authorId===actor.id`). 404(없음) 먼저, 그다음 403(권한).
- **댓글 옵셔널 인증**: `OptionalJwtAuthGuard`(토큰 없거나 무효여도 401 대신 익명 통과). 로그인 시 `Comment.userId` 연결(실명), 비로그인은 기존 `displayName`(익명) 병행.

### 5. 마이그레이션
`Comment.userId`(nullable, FK `onDelete: SetNull`) 추가 — 사용자 삭제 시 댓글은 익명으로 보존(트리 무결성). 기존 백필 패턴(`20260604000000_add_user_display_name`)을 따르고 dev `blog` + test `blog_test` 양쪽에 적용한다.

## 범위 외 (Out of Scope) — 추후 재평가
- **이메일 인증**(가입 시 메일 확인) 및 **비밀번호 재설정** — SMTP 인프라가 없어 이번 범위에서 제외. 가입은 즉시 활성, 비밀번호 변경은 운영자 수동/시드. 도입 시 별도 ADR.
- 세분화 역할(EDITOR/CONTRIBUTOR), 권한(permission) 테이블, 소셜 로그인, AUTHOR 전용 "내 글" 대시보드.

## 결과 (Consequences)

긍정:
- 다중 작성자·회원 블로그로 확장. 역할 승격/강등이 즉시 반영.
- 토큰에 역할 비노출 + 삭제 계정 즉시 무효화로 보안 유지.
- 소유권 검사가 도메인(서비스)에 위치해 404/403 일관 처리.

부정/비용:
- `JwtStrategy.validate`가 요청당 user 1쿼리 추가(인덱스 PK 조회, 무시 가능 수준).
- 공개 가입으로 스팸/봇 가입 표면 증가 → 기본 역할 MEMBER(쓰기 불가) + throttler로 1차 완화.
- 스키마 마이그레이션 2건 효과(role + Comment.userId), dev/test 양쪽 적용 필요.
