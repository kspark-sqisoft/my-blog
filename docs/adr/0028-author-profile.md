# ADR-0028: author-profile — 공개 작성자 프로필 (User.id 식별, bio, 메타·목록 분리)

## 상태 (Status)

Accepted - 2026-06-08

(이 ADR 은 ADR-0025 를 **amend·supersede** 한다: §결정 6 참조.)

## 컨텍스트 (Context)

다저자 블로그(RBAC AUTHOR 다중 — ADR-0018)인데 글 목록·상세에 **작성자 이름만 보이고**, 그 작성자의 다른 글·소개를 볼 공개 페이지가 없다(PRD `docs/prd/author-profile.md`).

제약·평가 기준:
- `User.name` 은 **unique 가 아니다**(여러 '홍길동' 가능) → 프로필 URL 식별자로 부적합.
- `User` 에 소개(bio)·핸들(username) 필드가 **없다**.
- BC 규칙: **Auth 는 어떤 Context도 의존하지 않는 최하위**(`docs/bounded-contexts.md`). 작성자 프로필은 User 표시 속성(Auth) + 발행글 목록(Publishing)의 조합이라, 조립 주체를 잘못 두면 Auth→Publishing 역결합으로 이 불변식이 깨진다.
- 기존 자산 재사용: 아바타(ADR-0025), 발행 목록 읽기 모델·페이지네이션(ADR-0010), 작성자 표시 이름(ADR-0017).
- ADR-0025 는 "범위 외: 공개 프로필 페이지(타인이 보는)"를 명시했고, `PATCH /api/auth/me` 계약을 `{name?, avatarUrl?}` 로 고정했다.
- 절대 규칙 #9(반환 검증), 함정 #9(shared 순수성), #5(타입 단일 정의).

## 결정 (Decision)

공개 작성자 프로필을 **새 BC·새 모듈 없이 Auth(User.bio + 공개 프로필 읽기)와 Publishing(작성자별 발행글 목록) 확장**으로 구현한다.

1. **URL 식별자 = `User.id`(cuid)**. `/users/:id`. 핸들(username)은 도입하지 않는다(범위 외 — 추가 unique 컬럼·가입 폼·기존 유저 백필 비용 회피). cuid 노출은 공개 정보뿐이라 위험이 낮다.

2. **`User.bio String?` nullable 컬럼 추가**(추가 전용 마이그레이션). 작성자 소개, 최대 200자(api class-validator). 빈 값/null 허용.

3. **메타와 목록을 분리한다**: 프로필 메타는 `GET /api/users/:id`(AuthModule, `@Controller('users')`, 공개) — `AuthorProfileDto{id,name,avatarUrl,bio,createdAt,postCount}`, **이메일 비노출**, 없으면 404. 작성자 발행글 목록은 `GET /api/posts?author=:id`(PublishingModule, 기존 `listPublished` 에 `authorId` 필터 추가 — tag·q 와 동형). **조립은 web 프레젠테이션**이 두 읽기를 합쳐 수행한다 → **Auth 는 Publishing 을 의존하지 않아 "Auth 최하위" 불변식이 유지된다.**

4. **`PostSummaryDto` 에 `authorId: string` 노출**(작성자 링크 M3 — 글 목록 카드·상세 작성자 이름 → `/users/:authorId`). `toSummary` 직렬화에 매핑하고 기존 응답 필드는 불변.

5. **발행 격리·이메일 비노출**: `postCount`·작성자 목록 모두 `status:PUBLISHED` 강제(초안·미발행 비노출). User 조회는 `select` 로 email 을 배제한다. bio 는 평문 저장·React 기본 escape 표시(`dangerouslySetInnerHTML` 금지).

6. **ADR-0025 amend·supersede**: (a) **amend** — `UpdateProfileDto`(`PATCH /api/auth/me`) 계약에 `bio?` 를 추가한다(본인 편집). `AuthUserDto` 에 `bio` 노출. (b) **supersede** — ADR-0025 의 "범위 외: 공개 프로필 페이지(타인이 보는)" 항목을 이 ADR 이 대체한다(이번에 구현).

7. **`posts` 에 `@@index([authorId, status, publishedAt])` 추가**. author 필터 + 발행 격리 + 발행일 정렬을 한 인덱스로 커버한다(기존 `@@index([status, publishedAt])` 는 author 선두가 아니라 작성자별 조회에 비효율). 추가 전용(비파괴).

8. **전 User 대상 공개**: AUTHOR/ADMIN뿐 아니라 발행글 0인 MEMBER 도 프로필 페이지를 갖는다(빈 목록). 명칭은 "작성자 프로필"로 유지. 비공개/비활성 작성자 처리는 범위 외.

shared 에는 순수 타입만 추가한다(`AuthorProfileDto`, `PostSummaryDto.authorId`, `AuthUserDto.bio`, `UpdateProfileDto.bio` — 함정 #9). 폼 zod 는 web 인라인.

## 결과 (Consequences)

긍정:
- 새 BC·Aggregate·Domain Event 가 없고(User.bio 속성 1개 + 발행 읽기 파생), 기존 아바타·발행 목록·작성자 표시 자산을 재사용한다.
- 메타·목록 분리 + web 조합으로 **Auth 최하위 불변식**을 지키고, 작성자 목록은 기존 목록 API 의 필터 한 갈래라 중복 로직이 없다.
- `User.id` 식별로 추가 스키마(username·유일성·백필)가 없어 단순하고 안정적이다.
- 인덱스(`authorId, status, publishedAt`)로 작성자별 발행 목록이 정렬까지 인덱스로 처리된다.

부정/감수해야 할 것:
- `/users/clx123...`(cuid) URL 은 길고 사람이 읽기 어렵다(예쁜 핸들은 후속 ADR 로 가능).
- 작성자 프로필 조립이 web 에 있어 클라이언트가 **두 번 요청**(메타 + 목록)한다(서버 단일 응답보다 라운드트립 1회 증가 — Auth 불변식 유지를 위한 트레이드오프).
- `PostSummaryDto.authorId` 추가로 목록 응답이 약간 커지고, 직렬화·회귀 검증이 필요하다.
- bio 평문만 지원(서식·마크다운 없음). 길이 200자 제한.

## 검토 시점

- 예쁜 URL(핸들/username)이 필요해지면 별도 ADR 로 `/users/:handle` 을 도입(이 ADR 의 `:id` 와 병행/대체).
- 작성자 활동 통계(좋아요·댓글 합계)·팔로우·프로필 커버 이미지는 후속 기능에서 결정.
- web 의 두 요청 조립이 성능 이슈가 되면 서버 집계 엔드포인트(BFF) 도입을 재평가(단 Auth→Publishing 직결합은 피한다).
