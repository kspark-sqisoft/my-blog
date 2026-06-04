# 유비쿼터스 언어 - my-blog

이 문서는 프로젝트에서 쓰이는 도메인 용어를 정의한다.
사용자 대화, 문서, 코드, DB 모두 이 정의를 따른다.

## Post (게시글)- 정의: 작성자가 발행한 글 한 건- 소속 Context: Publishing- 코드 표현: `Post` (Prisma 모델, `packages/api/prisma/schema.prisma`)- UI 표현: "게시글" 또는 "글"- 동의어 금지: Article, Entry, Document, Story 같은 단어 사용 금지

## Comment (댓글)- 정의: 특정 Post에 달리는 짧은 의견. 다른 Comment에 답글로 달릴 수 있다 (깊이 2까지: 최상위→답글→답글의 답글, 그 이상 금지 — ADR-0013)- 소속 Context: Conversation- 코드 표현: `Comment` (parentId 필드로 답글 관계 표현)- UI 표현: "댓글" / 답글은 "답글"- 동의어 금지: Reply, Note, Feedback

## Tag (태그)- 정의: Post를 분류하는 짧은 키워드. Post당 0~5개- 소속 Context: Publishing (Value Object - 독립 Aggregate 아님)- 코드 표현: `Tag` 모델 + `PostTag` 조인 테이블- UI 표현: "태그"

## Author (작성자)- 정의: Post 또는 Comment를 작성한 사용자- 주의: User와 다른 개념이 아니다. "User의 역할 중 하나"가 Author. RBAC 도입 후 글을 쓸 수 있는 역할은 `ADMIN`·`AUTHOR`이며, 둘 다 작성한 글의 Author가 된다(ADR-0018).- 소속 Context: Auth (User 자체) / Publishing (Post의 Author 관계)- 코드 표현: User 모델 + Post.authorId 외래키

## User (사용자)- 정의: 시스템에 가입한 사람. 이메일이 유일 식별자- 소속 Context: Auth- 코드 표현: `User` (Prisma 모델)- 동의어 금지: Account (코드와 문서에서 통일). ※ "Member"는 ADR-0018 이후 **역할(Role)의 한 값**으로 정식 용어가 됐으므로 더 이상 금지어가 아니다(아래 Member 항목 참조).

## Role (역할)- 정의: User가 가진 권한 수준. 3단계 enum `UserRole`: `ADMIN`(슈퍼관리자·전체 관리·사용자 관리), `AUTHOR`(본인 글 작성/수정/삭제/발행), `MEMBER`(로그인 독자·실명 댓글). User당 정확히 하나(ADR-0018)- 소속 Context: Auth- 코드 표현: `User.role` (Prisma enum `UserRole`), 공유 타입 `UserRole`(`packages/shared`)- UI 표현: "역할" / "관리자·작성자·회원"- 동의어 금지: Permission(권한 단위 개념과 구분), Grade, Level

## Member (회원)- 정의: 역할 `MEMBER`인 사용자. 글은 못 쓰고, 로그인 상태로 **실명 댓글**만 단다- 주의: ADR-0019 이후 `MEMBER`는 *가입 직후 상태가 아니라* **운영자가 글쓰기 권한을 회수(강등)한 사용자**의 역할이다(공개 가입자의 기본 역할은 `AUTHOR`). 비로그인 "익명 독자"와도 구분된다. "운영자"는 역할 `ADMIN`인 회원의 통칭- 소속 Context: Auth- 코드 표현: `UserRole = 'MEMBER'`- 동의어 금지: 구독자(Subscriber), 게스트(Guest)

## 운영자 (Operator/Admin)- 정의: 역할 `ADMIN`인 User. 슈퍼관리자로서 전체 글 관리 + 사용자/역할 관리 권한을 가진다. 최초 1인은 시드로 부트스트랩(ADR-0002→0018), 이후 운영자가 다른 User를 승격할 수 있다- 소속 Context: Auth- 코드 표현: `UserRole = 'ADMIN'`- UI 표현: "운영자" 또는 "관리자"

## 회원가입 (Register)- 정의: 비회원이 email·password·이름으로 계정을 만드는 행위. 기본 역할은 **`AUTHOR`** 라 가입 즉시 본인 글을 쓸 수 있다(ADR-0019, ADR-0018의 기본 `MEMBER`를 갱신). 공개 엔드포인트, 클라이언트가 role 지정 불가, 이메일 인증은 범위 외- 소속 Context: Auth- 코드 표현: `POST /api/auth/register`, `RegisterDto`(`packages/shared`)- UI 표현: "회원가입"- 동의어 금지: Sign up(문서는 "회원가입"으로 통일), 등록(Enroll)

## 대표 이미지 (Cover Image)- 정의: Post 목록에서 각 글을 대표하는 이미지. 본문 마크다운의 **첫 번째 미디어**를 대표로 삼는다(별도 지정 UI 없음). 본문에 미디어가 없으면 대표는 없다(null). 첫 미디어가 비디오(`.mp4`)면 카드에서는 비디오의 첫 프레임을 같은 역할로 사용한다(ADR-0020).- 소속 Context: Publishing (Post 요약 읽기 모델에서 본문으로부터 파생, 별도 저장하지 않음 — ADR-0015)- 코드 표현: `PostSummaryDto.coverImageUrl: string | null` (`packages/shared`, 이름은 호환 유지). 파생은 api `extractFirstImageUrl()`- UI 표현: 글 목록 카드 상단의 커버 (없으면 줄무늬 플레이스홀더)- 동의어 금지: 썸네일(Thumbnail), 히어로(Hero), 배너(Banner) — "대표 이미지"로 통일

## 미디어 (Media)- 정의: 본문에 임베드되는 시각 자산의 총칭. 현재는 **이미지**(jpeg/png/gif/webp) 와 **비디오**(mp4) 두 종류(ADR-0012, ADR-0020). 본문 마크다운에서는 형태 구분 없이 `![alt](url)` 로 임베드되고, 클라이언트 렌더러가 URL 확장자로 `<img>`/`<video>` 를 분기한다.- 소속 Context: Publishing- 코드 표현: 단일 엔드포인트 `POST /api/uploads`, 응답 `UploadResult.type: 'image'|'video'`- UI 표현: 작성 화면의 "미디어 업로드" 버튼

## 비디오 (Video)- 정의: 본문에 임베드되는 짧은 MP4 클립. 50MB 이하, `video/mp4` 만 허용(ADR-0020). 자동재생하지 않으며, 상세 화면에서만 컨트롤로 재생한다. 목록 카드에는 첫 프레임만 멈춰 표시된다.- 소속 Context: Publishing- 코드 표현: 마크다운 본문의 `![alt](*.mp4)` (별도 모델 없음)- UI 표현: 상세에서는 `<video controls>`, 목록 카드에서는 `<video preload="metadata" muted playsInline>` 의 첫 프레임- 동의어 금지: Movie, Clip(코드/문서는 "비디오"로 통일)

## 포스터 프레임 (Poster Frame)- 정의: 비디오가 재생되기 전 정지 상태로 보이는 첫 화면. 별도 이미지 업로드 없이 비디오 메타데이터의 첫 프레임을 그대로 사용한다(ADR-0020, ffmpeg 의존 0).- 소속 Context: Publishing (프레젠테이션 파생)- 코드 표현: `<video preload="metadata">` 의 기본 동작- UI 표현: 글 목록 카드 커버에서 비디오일 때 보이는 정지 화면

## 본문 HTML (Content HTML)- 정의: Post 의 본문 텍스트. **WYSIWYG 에디터(TipTap)** 로 작성되고 **sanitize 된 HTML** 로 저장된다(ADR-0021, ADR-0003 supersede). 화이트리스트(`richHtmlSchema`, `packages/shared`)에 포함된 태그·속성·Tailwind 클래스만 허용.- 소속 Context: Publishing- 코드 표현: `Post.contentHtml: string` (Prisma), `PostDetailDto.contentHtml` (`packages/shared`). 서버 sanitize 는 `sanitize-html`, 클라 추가 sanitize 는 `dompurify`- UI 표현: 작성 화면의 리치 에디터, 상세 화면의 `<RichContent>` 렌더러- 동의어 금지: Markdown(본문은 더 이상 마크다운이 아님), Rich Text(통칭 — 코드/문서는 "본문 HTML")

## 리치 에디터 (Rich Editor)- 정의: 본문 작성용 WYSIWYG 에디터(TipTap 기반, ProseMirror 위). 표준 서식 + 색·크기 프리셋 + 미디어 업로드를 한 화면에서 제공한다(ADR-0021).- 소속 Context: Publishing (프레젠테이션)- 코드 표현: `packages/web/src/components/editor/RichEditor.tsx` + `Toolbar.tsx`. 확장: `StarterKit`, `Link`, `Underline`, `Image`, 커스텀 `Video`, `TextStyle`, `Color`, 커스텀 `FontSize`- UI 표현: `/admin/posts/new` 와 `/admin/posts/:id/edit` 의 본문 입력 영역- 동의어 금지: WYSIWYG(통칭), Editor(범용) — 코드/문서는 "리치 에디터"

## 테마 (Theme)- 정의: 화면 색상 모드. 라이트/다크 두 가지. 사용자가 토글로 전환하며 선택은 브라우저에 보존된다.- 소속 Context: WEB(프레젠테이션 — 도메인 Bounded Context 아님)- 코드 표현: `useTheme`(zustand), `document.documentElement[data-theme]`, localStorage `blog-theme`- UI 표현: 상단 네비게이션의 해/달 아이콘 토글- 동의어 금지: 스킨(Skin), 다크모드(단독 사용) — 모드 일반은 "테마"로 통일
