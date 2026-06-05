# ADR-0025: 사용자 프로필 + 아바타 (이름·아바타 편집, 작성자 아바타 표시)

## 상태 (Status)

Accepted - 2026-06-05

## 컨텍스트 (Context)

로그인 사용자가 자기 정체성을 표현/관리할 방법이 없다. 상단에 누가 로그인했는지 안 보이고,
표시 이름은 가입 후 못 바꾸며, 댓글·글의 작성자는 이름 텍스트만 보인다. "고급 블로그"의 사용자
경험으로 (1) 상단에 본인 이메일/아바타 노출 + 프로필 진입, (2) 프로필에서 이름·아바타 편집,
(3) 댓글·글 작성자에 아바타 표시를 도입한다.

## 결정 (Decision)

### 1. 모델
- `User.avatarUrl String?` (nullable) 추가. 값은 **로컬 업로드 경로(`/uploads/...`)** 또는 null.

### 2. 아바타 업로드 — 전용 엔드포인트(인증 사용자)
- `POST /api/profile/avatar` (`JwtAuthGuard`, **전 역할** 로그인). 기존 `/api/uploads`(운영자 전용)와
  분리한다 — 일반 회원도 아바타가 필요하고, 의도·정책(이미지 전용·작은 크기)이 다르기 때문.
- 이미지 전용(jpeg/png/gif/webp, **비디오 불가**), 크기 상한 **2MB**. 기존 `StorageProvider`(로컬,
  `/uploads/*` 서빙)를 재사용한다. 응답 `{ url }`.
- 업로드는 파일을 저장하고 URL 만 반환한다(미리보기). 영속화는 PATCH 가 한다(편집 후 저장 흐름).

### 3. 프로필 수정 — `PATCH /api/auth/me`
- `JwtAuthGuard`. 본문 `{ name?, avatarUrl? }`. 본인 User 만 수정한다(토큰의 sub).
- `name`: 1~50자. `avatarUrl`: **`/uploads/` 로 시작하는 로컬 경로 또는 null 만 허용**(외부 URL·
  `javascript:` 등 거부 — 저장 시 검증). 응답 `{ user: AuthUserDto }`(갱신).
- **이메일·비밀번호는 변경 불가**(범위 외). 이메일은 식별자라 읽기전용으로만 표시한다.

### 4. 응답 노출
- `AuthUserDto` 에 `avatarUrl: string | null` 추가(`/me`·`/login`·`/register`·`PATCH /me` 공통).
- `CommentDto`·`PostSummaryDto`·`PostDetailDto` 에 `authorAvatarUrl: string | null` 추가. 작성자
  User 의 `avatarUrl` 을 join 한다. 익명 댓글·아바타 미설정은 null.

### 5. 프론트
- `Avatar` 컴포넌트: `src` 있으면 `<img>`, 없으면 **이니셜 원형 폴백**(이름 첫 글자). NavBar·댓글·글에서 재사용.
- NavBar 우측: 로그인 시 `Avatar + 이메일` → 클릭 시 `/profile`. 앱 로드 시 `fetchMe` 1회로 사용자 로드.
- `/profile`: 로그인 필요(역할 무관, `ProtectedRoute`). 이메일(읽기전용) + 이름(편집) + 아바타(미리보기·업로드).
- 댓글(`CommentTree`)·글(`PostDetail`·`PostListView`) 작성자에 `Avatar` 표시.

## 범위 외 (Out of Scope)
- 이메일/비밀번호 변경, 계정 삭제, 공개 프로필 페이지(타인이 보는), 아바타 크롭/리사이즈, 소셜 로그인.

## 결과 (Consequences)

긍정:
- 로그인 정체성 가시화 + 자기 표현(이름·아바타). 작성자 아바타로 댓글/글의 사람 느낌 강화.
- 업로드 분리(전용 엔드포인트)로 회원 업로드 권한이 운영자 이미지 업로드와 섞이지 않음.
- avatarUrl 로컬경로 강제로 외부 URL 추적/주입 위험 차단.

부정/비용:
- User 에 표시용 컬럼(avatarUrl) 추가 + 댓글/글 응답에 join 1개. 작은 비용.
- 아바타 파일 생명주기 관리(교체 시 이전 파일 잔존) — v1 은 정리하지 않음(고아 파일 허용, 추후 정리 태스크).
