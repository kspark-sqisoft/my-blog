# 유비쿼터스 언어 - my-blog

이 문서는 프로젝트에서 쓰이는 도메인 용어를 정의한다.
사용자 대화, 문서, 코드, DB 모두 이 정의를 따른다.

## Post (게시글)- 정의: 작성자가 발행한 글 한 건- 소속 Context: Publishing- 코드 표현: `Post` (Prisma 모델, `packages/api/prisma/schema.prisma`)- UI 표현: "게시글" 또는 "글"- 동의어 금지: Article, Entry, Document, Story 같은 단어 사용 금지

## Comment (댓글)- 정의: 특정 Post에 달리는 짧은 의견. 다른 Comment에 답글로 달릴 수 있다 (깊이 2까지: 최상위→답글→답글의 답글, 그 이상 금지 — ADR-0013)- 소속 Context: Conversation- 코드 표현: `Comment` (parentId 필드로 답글 관계 표현)- UI 표현: "댓글" / 답글은 "답글"- 동의어 금지: Reply, Note, Feedback

## Tag (태그)- 정의: Post를 분류하는 짧은 키워드. Post당 0~5개- 소속 Context: Publishing (Value Object - 독립 Aggregate 아님)- 코드 표현: `Tag` 모델 + `PostTag` 조인 테이블- UI 표현: "태그"

## Author (작성자)- 정의: Post 또는 Comment를 작성한 사용자- 주의: User와 다른 개념이 아니다. "User의 역할 중 하나"가 Author. RBAC 도입 후 글을 쓸 수 있는 역할은 `ADMIN`·`AUTHOR`이며, 둘 다 작성한 글의 Author가 된다(ADR-0018).- 소속 Context: Auth (User 자체) / Publishing (Post의 Author 관계)- 코드 표현: User 모델 + Post.authorId 외래키

## User (사용자)- 정의: 시스템에 가입한 사람. 이메일이 유일 식별자- 소속 Context: Auth- 코드 표현: `User` (Prisma 모델)- 동의어 금지: Account (코드와 문서에서 통일). ※ "Member"는 ADR-0018 이후 **역할(Role)의 한 값**으로 정식 용어가 됐으므로 더 이상 금지어가 아니다(아래 Member 항목 참조).

## Role (역할)- 정의: User가 가진 권한 수준. 3단계 enum `UserRole`: `ADMIN`(슈퍼관리자·전체 관리·사용자 관리), `AUTHOR`(본인 글 작성/수정/삭제/발행), `MEMBER`(로그인 독자·실명 댓글). User당 정확히 하나(ADR-0018)- 소속 Context: Auth- 코드 표현: `User.role` (Prisma enum `UserRole`), 공유 타입 `UserRole`(`packages/shared`)- UI 표현: "역할" / "관리자·작성자·회원"- 동의어 금지: Permission(권한 단위 개념과 구분), Grade, Level

## Member (회원)- 정의: 가입해 로그인하는 일반 사용자. 역할 `MEMBER`. 글은 못 쓰고, 로그인 상태로 **실명 댓글**을 단다(ADR-0018)- 주의: 비로그인 "익명 독자"와 구분된다. "운영자"는 역할 `ADMIN`인 회원의 통칭- 소속 Context: Auth- 코드 표현: `UserRole = 'MEMBER'`- 동의어 금지: 구독자(Subscriber), 게스트(Guest)

## 운영자 (Operator/Admin)- 정의: 역할 `ADMIN`인 User. 슈퍼관리자로서 전체 글 관리 + 사용자/역할 관리 권한을 가진다. 최초 1인은 시드로 부트스트랩(ADR-0002→0018), 이후 운영자가 다른 User를 승격할 수 있다- 소속 Context: Auth- 코드 표현: `UserRole = 'ADMIN'`- UI 표현: "운영자" 또는 "관리자"

## 회원가입 (Register)- 정의: 비회원이 email·password·이름으로 계정을 만들어 회원(MEMBER)이 되는 행위. 공개 엔드포인트(ADR-0018). 이메일 인증은 범위 외- 소속 Context: Auth- 코드 표현: `POST /api/auth/register`, `RegisterDto`(`packages/shared`)- UI 표현: "회원가입"- 동의어 금지: Sign up(문서는 "회원가입"으로 통일), 등록(Enroll)

## 대표 이미지 (Cover Image)- 정의: Post 목록에서 각 글을 대표하는 이미지. 본문 마크다운의 **첫 번째 이미지**를 대표 이미지로 삼는다(별도 지정 UI 없음). 본문에 이미지가 없으면 대표 이미지는 없다(null).- 소속 Context: Publishing (Post 요약 읽기 모델에서 본문으로부터 파생, 별도 저장하지 않음 — ADR-0015)- 코드 표현: `PostSummaryDto.coverImageUrl: string | null` (`packages/shared`). 파생은 api `extractFirstImageUrl()`- UI 표현: 글 목록 카드 상단의 커버 이미지 (없으면 줄무늬 플레이스홀더)- 동의어 금지: 썸네일(Thumbnail), 히어로(Hero), 배너(Banner) — "대표 이미지"로 통일

## 테마 (Theme)- 정의: 화면 색상 모드. 라이트/다크 두 가지. 사용자가 토글로 전환하며 선택은 브라우저에 보존된다.- 소속 Context: WEB(프레젠테이션 — 도메인 Bounded Context 아님)- 코드 표현: `useTheme`(zustand), `document.documentElement[data-theme]`, localStorage `blog-theme`- UI 표현: 상단 네비게이션의 해/달 아이콘 토글- 동의어 금지: 스킨(Skin), 다크모드(단독 사용) — 모드 일반은 "테마"로 통일
