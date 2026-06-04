# Bounded Contexts - my-blog

> 도메인 모델 정의. 용어는 `docs/glossary.md`, 요구사항은 `docs/prd/blog-mvp.md`를 따른다.
>
> DDD 원칙:
> - Aggregate는 외부에서 **ID로만 참조** (객체 직접 참조 금지)
> - 한 트랜잭션 = 한 Aggregate만 수정
> - 단순 CRUD는 억지로 쪼개지 않는다

## Context 목록

blog-mvp는 3개의 Bounded Context로 구성된다: **Publishing**, **Conversation**, **Auth**.

### Publishing

| 항목 | 내용 |
|---|---|
| **책임** | 운영자/작성자가 Post를 작성·수정·삭제·발행하고 Tag로 분류한다. 본문은 sanitize 된 HTML(`contentHtml`, ADR-0021 — ADR-0003 supersede)이며 WYSIWYG 에디터(TipTap)로 작성된다. 본문용 미디어(이미지/비디오)는 같은 엔드포인트로 업로드한다(ADR-0012, ADR-0020). 발행된 Post를 독자에게 노출한다. |
| **Aggregate Root** | `Post` (Entity) |
| **다른 객체** | `Tag` (Value Object — Post당 0~5개, 독립 Aggregate 아님). 이미지는 별도 엔티티 없이 마크다운 URL로 임베드(ADR-0012) |
| **Domain Events** | `PostPublished`, `PostUnpublished`, `PostDeleted` |
| **다른 Context 의존** | Auth를 안다 — Post는 Author(User)를 `authorId`로 참조 |

- 발행 상태(초안/발행)는 Post Aggregate 내부 상태로 관리한다.
- Tag는 Post를 통해서만 다뤄진다 (Tag 자체 생명주기를 독립 관리하지 않음).
- **목록 읽기 모델(PostSummary)** 은 Post 본문에서 두 값을 **파생**한다: 평문 요약과 대표 이미지(본문 첫 이미지). 둘 다 저장 컬럼이 아니라 조회 시 본문에서 계산한다(ADR-0015). 따라서 Aggregate·스키마·Domain Event는 바뀌지 않는다.

> 프론트(WEB)는 이 Context들을 소비하는 **프레젠테이션 계층**이며 별도 Bounded Context가 아니다. 시각 디자인 시스템·테마(라이트/다크)는 도메인 모델에 영향을 주지 않는다(ADR-0016).

### Conversation

| 항목 | 내용 |
|---|---|
| **책임** | 독자가 발행된 Post에 Comment를 달고 깊이 2까지 답글로 소통한다. |
| **Aggregate Root** | `Comment` (Entity) |
| **다른 객체** | 답글 관계는 `parentId` 자기참조로 표현 (깊이 2까지 — ADR-0013) |
| **Domain Events** | `CommentPosted` |
| **다른 Context 의존** | Publishing을 안다 — Comment는 대상 Post를 `postId`로 참조. Auth를 **선택적으로** 안다 — 로그인 회원의 Comment는 `userId`(nullable)로 User를 참조한다(ADR-0018). 비로그인 Comment는 익명(`displayName`). |

- Comment는 대상 Post를 `postId`로만 참조한다 (Post 객체 직접 참조 금지).
- 답글도 다른 Comment를 `parentId`로 참조하며 깊이 2까지만 허용한다(서비스 계층에서 강제 — ADR-0013).
- 작성자 식별은 **선택적**이다: 로그인이면 `userId`로 실명(User.name), 비로그인이면 `displayName`로 익명. `userId` FK는 `onDelete: SetNull`이라 사용자 삭제 시 댓글은 익명으로 보존된다(ADR-0018).

### Auth

| 항목 | 내용 |
|---|---|
| **책임** | User를 인증·식별하고 **역할(Role)로 권한을 부여**한다. 이메일이 유일 식별자. 회원가입·로그인·역할 관리의 주체. 모든 쓰기 권한의 근거. |
| **Aggregate Root** | `User` (Entity) — `role`(`UserRole`: ADMIN/AUTHOR/MEMBER)을 속성으로 가진다 |
| **다른 객체** | `UserRole` (Value Object — enum) |
| **Domain Events** | `UserRegistered`, `UserRoleChanged` (ADR-0018) |
| **다른 Context 의존** | 없음 — 다른 Context가 User를 `userId`로 참조한다(역방향 의존 없음, 가장 안정적) |

- 공개 회원가입은 기본 역할 `AUTHOR`로 생성한다(가입 즉시 본인 글 작성 — ADR-0019, ADR-0018의 기본 `MEMBER`를 갱신). 운영자(`ADMIN`)는 글쓰기 권한을 회수하려면 `MEMBER`로 강등할 수 있다.
- 권한 검사: 정적 역할은 가드(`RolesGuard`), 리소스 소유권(AUTHOR 본인 글)은 서비스 계층에서 판정한다(ADR-0018). 운영자 Post 목록/상세도 actor로 스코프한다(ADMIN 전체 / AUTHOR 본인 — ADR-0019).
- 최초 `ADMIN`은 시드로 부트스트랩한다(ADR-0002는 ADR-0018로 supersede — 공개 가입 추가).

## Context 간 의존 다이어그램

```
   ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
   │   Conversation   │        │    Publishing    │        │       Auth       │
   │                  │        │                  │        │                  │
   │   Comment (AR)   │        │    Post (AR)     │        │    User (AR)     │
   │   - parentId     │        │    - Tag (VO)    │        │                  │
   └────────┬─────────┘        └────────┬─────────┘        └─────────┬────────┘
            │                           │                            │
            │  postId 참조               │  authorId 참조              │
            └──────────────────────────▶└───────────────────────────▶│
                 (Comment → Post)            (Post → User)            │
            │                                                         │
            │  userId 참조 (선택적 — 로그인 회원 댓글, ADR-0018)         │
            └────────────────────────────────────────────────────────▶│
                 (Comment → User, nullable)

   의존 방향: Conversation ──▶ Publishing ──▶ Auth
              Conversation ──▶ Auth (선택적, userId nullable)
   (하위 Context가 상위 Context를 ID로만 참조. 역방향 의존 없음)
```

- 모든 Context 간 참조는 **ID 참조**다 (`postId`, `authorId`, `userId`).
- Auth는 어떤 Context도 의존하지 않는 최하위(가장 안정적) Context다.
- Conversation→Auth는 **선택적** 의존이다: 로그인 회원 댓글만 `userId`로 User를 참조하고, 익명 댓글은 Auth를 모른다(ADR-0018).

## NestJS 모듈 매핑

| Bounded Context | NestJS 모듈 | 주요 책임 |
|---|---|---|
| Publishing | `PublishingModule` (또는 `PostModule`) | Post CRUD·발행, Tag 분류·탐색, 이미지 업로드(StorageProvider) |
| Conversation | `ConversationModule` (또는 `CommentModule`) | Comment 작성·조회, 깊이 2 답글 |
| Auth | `AuthModule` | User 인증(회원가입·로그인), 역할 관리(`RolesGuard`/`@Roles`), 쓰기/관리 권한 검증. 사용자 관리 API 포함 |

> 모듈 경계는 Context 경계와 1:1로 맞춘다. 모듈 간 호출은 ID 기반 인터페이스로만 한다.
> 구체적 라이브러리·스키마·API 설계는 TRD에서 정의한다.
