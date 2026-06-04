# TRD - 다중 사용자 회원가입 + 역할 기반 권한(RBAC)

> 입력: `docs/prd/multiuser-rbac.md`, ADR-0018. 기존 인증 구조(ADR-0001 JWT 쿠키) 위에 확장한다.

## 핵심 기술 결정

| # | 결정 | 선택 |
|---|---|---|
| ① | 역할 모델 | **User.role enum `UserRole`**(ADMIN/AUTHOR/MEMBER), 단일 값 |
| ② | 역할 신선도 | **JWT는 `{sub,email}`만, validate에서 DB 재조회**로 role 획득(즉시 반영) |
| ③ | 권한 검사 위치 | **역할=가드(`RolesGuard`/`@Roles`), 소유권=서비스 계층**(actor 전달) |
| ④ | 댓글 인증 | **`OptionalJwtAuthGuard`**(로그인=실명 userId, 비로그인=익명 displayName 병행) |
| ⑤ | 공유 타입 | `UserRole`·`AuthUserDto(+role,name)`·`RegisterDto`·`AdminUserDto`·`UpdateUserRoleDto`를 `packages/shared`에 단일 정의 |

## DB 스키마 변경 (Prisma)

```prisma
enum UserRole { ADMIN AUTHOR MEMBER }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         UserRole @default(MEMBER)   // 신규
  createdAt    DateTime @default(now())
  posts        Post[]
  comments     Comment[]                    // 신규 역참조
  @@map("users")
}

model Comment {
  // ...기존...
  userId String?
  user   User?  @relation(fields: [userId], references: [id], onDelete: SetNull)  // 신규
  // displayName(익명) 유지
}
```

마이그레이션 `add_user_role_and_comment_user`: ① `CREATE TYPE "UserRole"` ② `users.role` 추가(DEFAULT 'MEMBER') ③ `UPDATE users SET role='ADMIN'`(이 시점 DB엔 시드 운영자만) ④ `comments.userId` + FK(SetNull) + index. dev `blog` + test `blog_test` 양쪽 적용.

## 모듈 구조

| 모듈 | 추가/변경 |
|---|---|
| `AuthModule` | `RolesGuard`·`Roles`·`OptionalJwtAuthGuard` 추가(providers+exports). `JwtStrategy`에 PrismaService 주입(@Global). `register()`. `user-admin.controller`(사용자 관리). |
| `PublishingModule` | 이미 `AuthModule` import. post.controller에 `@Roles`, post.service에 actor 소유권. |
| `ConversationModule` | **`imports: [AuthModule]` 추가**(OptionalJwtAuthGuard). comment에 userId/실명. |

## API 명세 (신규/변경)

### POST `/api/auth/register` (공개)
```
요청: { email, password(8~72), name(1~50) }
응답 201: { user: { id, email, name, role:'MEMBER' } } + Set-Cookie: access_token
오류 409: 이미 사용 중인 이메일
```

### GET `/api/auth/me`, POST `/api/auth/login` (변경)
- 응답 user에 `name`·`role` 추가: `{ id, email, name, role }`.

### GET `/api/admin/users` (ADMIN)
```
응답 200: Paginated<AdminUserDto>  // { id, email, name, role, createdAt }
```
### PATCH `/api/admin/users/:id/role` (ADMIN)
```
요청: { role: 'ADMIN'|'AUTHOR'|'MEMBER' }
응답 200: AdminUserDto
오류 409: 마지막 ADMIN은 강등할 수 없습니다
```

### 글 엔드포인트 (가드 추가)
- `POST /api/posts`, `PATCH/DELETE /api/posts/:id`, `publish`/`unpublish`, `POST /api/uploads` → `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('AUTHOR','ADMIN')`.
- `PATCH/DELETE/publish/unpublish`는 서비스에서 AUTHOR 본인(authorId===actor.id) 아니면 403.
- `GET /api/admin/posts`, `/:id` → `@Roles('ADMIN')`.

### POST `/api/posts/:postId/comments` (변경)
- `@UseGuards(OptionalJwtAuthGuard, ThrottlerGuard)`. 로그인이면 `userId` 연결+실명(user.name), 비로그인이면 `displayName`.

## 타입 계약 (packages/shared)

```ts
export type UserRole = 'ADMIN' | 'AUTHOR' | 'MEMBER';
export interface AuthUserDto { id: string; email: string; name: string; role: UserRole; }
export interface RegisterDto { email: string; password: string; name: string; }
export interface AdminUserDto { id: string; email: string; name: string; role: UserRole; createdAt: string; }
export interface UpdateUserRoleDto { role: UserRole; }
// CommentDto 확장: authorName: string | null; userId: string | null; (displayName 하위호환 유지)
```

## 가드 구현 (NestJS 표준)

- `@Roles(...roles)` = `SetMetadata(ROLES_KEY, roles)`.
- `RolesGuard.canActivate`: `Reflector.getAllAndOverride(ROLES_KEY, [handler, class])` → 없으면 통과, `req.user.role`이 포함 안 되면 `ForbiddenException(403)`.
- `OptionalJwtAuthGuard extends AuthGuard('jwt')`: `handleRequest(err,user){ return user ?? undefined }`.
- `PostService` actor: `interface Actor{id:string;role:UserRole}`. `assertCanMutate(post,actor)`: ADMIN 통과 / authorId===actor.id 통과 / else 403.

## 보안 처리

- 비밀번호 bcrypt(SALT_ROUNDS=10), `@MaxLength(72)`. role은 서버 고정(클라 미지정, whitelist 거부).
- 토큰 staleness: validate DB 재조회로 해소. 삭제 계정 401.
- 마지막 ADMIN 보호: 트랜잭션 내 `count(role=ADMIN)` 확인 후 update.
- CSRF/쿠키/throttle 정책은 기존(ADR-0001/0009) 유지.

## 테스트 전략

- 서비스 `*.spec`: post.service 소유권(ADMIN/AUTHOR/타인 403), roles.guard(메타 통과/403), auth.service register.
- e2e `test/*.e2e-spec`: 역할별 글 쓰기 403/200, register 201/409, admin-users 목록·역할변경·마지막ADMIN 409, 댓글 로그인=실명/비로그인=익명.
- 웹: Register/RoleRoute/Users/CommentForm 단위 + Playwright GWT(가입→승격→작성→소유권, 실명 댓글).
