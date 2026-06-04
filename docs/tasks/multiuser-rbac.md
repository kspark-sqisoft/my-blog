# Tasks - multiuser-rbac

> 입력: `docs/prd/multiuser-rbac.md`, `docs/trd/multiuser-rbac.md`, ADR-0018.
> 진행 상태 정규 소스는 `feature_list.json`(이 문서는 미러 — 절대 규칙 #10). 상태 변경은 `/finish`.
> Context 약어: AUTH=Auth, PUB=Publishing, CONV=Conversation, WEB=프론트. 모든 태스크 `tdd_first`(스키마/순수타입 예외).

## E9. 다중 사용자 RBAC (회원가입 + 역할 권한)

각 Phase는 앞 Phase 위에서 동작하지만, Phase 1~3(백엔드)은 프론트 변경 없이 배포해도 기존 UI를 깨지 않는다(추가적·하위호환).

### S9.1 스키마·역할·가드 (Phase 1 — 백엔드 기반)

#### T-AUTH-005 — User.role(UserRole) + Comment.userId 스키마·마이그레이션 + seed ADMIN
- priority: 36 / 의존: T-WEB-011 / status: done (2026-06-04)
- acceptance:
  1. schema.prisma에 `UserRole` enum, `User.role`(NOT NULL default MEMBER), `Comment.userId` nullable + FK(`onDelete: SetNull`).
  2. 마이그레이션이 기존 user를 ADMIN 백필(이 시점 DB엔 시드 운영자만 — ADR-0018 전제).
  3. `seedOperator`가 create/update 모두 role=ADMIN 부여(seed-operator.spec).
  4. dev `blog` + test `blog_test` 양쪽 migrate 적용.

#### T-AUTH-006 — shared 타입: UserRole + AuthUserDto(role,name) + Register/AdminUser/UpdateUserRole DTO
- priority: 37 / 의존: — / status: done (2026-06-04) / tdd_first: false(순수 타입)
- acceptance:
  1. `UserRole` 타입, `AuthUserDto`에 `role`·`name` 추가.
  2. `RegisterDto`/`AdminUserDto`/`UpdateUserRoleDto` export.
  3. shared 빌드 통과 + 기존 사용처 타입 통과.

#### T-AUTH-007 — JwtStrategy DB 재조회로 role 주입(즉시 반영) + 삭제계정 401
- priority: 38 / 의존: T-AUTH-005, T-AUTH-006 / status: done (2026-06-04)
- acceptance:
  1. validate가 PrismaService로 user 재조회해 `{id,email,name,role}` 반환.
  2. 삭제된 계정 토큰은 401.
  3. login/me 응답 user에 name·role 포함.

#### T-AUTH-008 — RBAC 가드: @Roles + RolesGuard(Reflector) + OptionalJwtAuthGuard
- priority: 39 / 의존: T-AUTH-006 / status: done (2026-06-04)
- acceptance:
  1. `@Roles`, `RolesGuard` 구현(메타 없으면 통과, 역할 불일치 403) — roles.guard.spec.
  2. `OptionalJwtAuthGuard`(토큰 없거나 무효여도 통과).
  3. AuthModule이 RolesGuard providers+exports.

#### T-PUB-105 — Post 소유권(Actor) + 컨트롤러 @Roles 부착
- priority: 40 / 의존: T-AUTH-007, T-AUTH-008 / status: done (2026-06-04)
- acceptance:
  1. post.service update/remove/publish/unpublish가 Actor 수용, ADMIN 전체/AUTHOR 본인/타인 403 — post.service.spec.
  2. post.controller 쓰기 `@Roles(AUTHOR,ADMIN)`+actor 전달, admin-post `@Roles(ADMIN)`, upload `@Roles(AUTHOR,ADMIN)`.
  3. post.e2e 역할별 200/403.

### S9.2 회원가입·사용자 관리 (Phase 2)

#### T-AUTH-009 — 회원가입 POST /api/auth/register (MEMBER, 409, 즉시 로그인)
- priority: 41 / 의존: T-AUTH-005, T-AUTH-006, T-AUTH-007 / status: done (2026-06-04)
- acceptance:
  1. RegisterDto 검증(email, password 8~72, name 1~50).
  2. MEMBER 생성 + bcrypt 해시, 중복 email 409.
  3. 성공 시 즉시 로그인 쿠키 + user 반환 — auth.e2e.

#### T-AUTH-010 — 사용자 관리 API: GET /api/admin/users, PATCH /:id/role (마지막 ADMIN 보호)
- priority: 42 / 의존: T-AUTH-008 / status: done (2026-06-04)
- acceptance:
  1. GET 목록(ADMIN, `Paginated<AdminUserDto>`).
  2. PATCH role 변경(ADMIN), `@IsIn` 검증.
  3. 마지막 ADMIN 강등 409(트랜잭션 count) — admin-users.e2e.

### S9.3 댓글 회원 연동 (Phase 3)

#### T-CONV-004 — 댓글 회원 연동: OptionalJwt + userId/실명, CommentDto authorName
- priority: 43 / 의존: T-AUTH-007, T-AUTH-008 / status: done (2026-06-04)
- acceptance:
  1. 로그인 댓글 userId 연결 + 실명(user.name), 비로그인 익명(displayName) 병행.
  2. CommentDto에 authorName·userId 추가(displayName 하위호환).
  3. ConversationModule이 AuthModule import — comment.e2e.

### S9.4 프론트엔드 (Phase 4)

#### T-WEB-012 — 회원가입 페이지 /register + useRegister
- priority: 44 / 의존: T-AUTH-009, T-AUTH-006 / status: done (2026-06-04)
- acceptance:
  1. /register RHF+Zod 폼, 성공 시 인증 + 홈 이동.
  2. 중복 409 에러 표시.
  3. NavBar 비인증 시 회원가입 링크.

#### T-WEB-013 — 역할별 라우트 게이팅 RoleRoute
- priority: 45 / 의존: T-WEB-012 / status: done (2026-06-04)
- acceptance:
  1. `RoleRoute(roles)` 컴포넌트.
  2. /admin/*→(AUTHOR,ADMIN), /admin/users→ADMIN.
  3. MEMBER는 / 로 리다이렉트 — routes.test.

#### T-WEB-014 — 사용자 관리 화면 /admin/users (ADMIN)
- priority: 46 / 의존: T-WEB-013, T-AUTH-010 / status: todo
- acceptance:
  1. 목록 + 역할 변경 셀렉트(useAdminUsers/useUpdateUserRole).
  2. 마지막 ADMIN 409 처리(토스트/에러).
  3. ADMIN만 사이드바 사용자 링크.

#### T-WEB-015 — 댓글 폼 실명 자동 + CommentTree authorName
- priority: 47 / 의존: T-CONV-004, T-WEB-012 / status: todo
- acceptance:
  1. 로그인 시 이름 입력 숨기고 user.name 표시, displayName 미전송.
  2. CommentTree authorName 표시.
  3. e2e GWT: 가입→승격→작성 소유권, 실명 댓글.

## 요약

| 스토리 | Context | 태스크 |
|---|---|---|
| S9.1 스키마·역할·가드 | AUTH·PUB | T-AUTH-005~008, T-PUB-105 (5) |
| S9.2 회원가입·사용자 관리 | AUTH | T-AUTH-009~010 (2) |
| S9.3 댓글 연동 | CONV | T-CONV-004 (1) |
| S9.4 프론트 | WEB | T-WEB-012~015 (4) |
| **합계** | | **12** |

> 진행/완료 판정은 `feature_list.json` 기준. ADR-0018(Accepted), PRD/TRD/glossary/bounded-contexts는 본 기능의 Phase 0~6 산출물로 이미 작성됨.
