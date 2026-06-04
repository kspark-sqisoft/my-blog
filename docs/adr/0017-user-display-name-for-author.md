# ADR-0017: 작성자 표시를 위해 User에 name(표시 이름) 필드 추가

## 상태 (Status)

Accepted - 2026-06-04

## 컨텍스트 (Context)

글 목록(공개)과 글 상세 화면에 **작성자 이름**을 표시해야 한다. 현재 `User` 모델은 `email`/`passwordHash`/`createdAt`만 가지며 사람이 읽을 표시 이름이 없다. `Post`는 `authorId`/`author` 관계를 갖지만, 목록 DTO(`PostSummaryDto`)에는 작성자 필드가 아예 없고 상세 DTO(`PostDetailDto`)에는 `authorId`(식별자)만 노출된다.

작성자 이름의 출처로 세 가지를 검토했다.
1. `email` 전체를 노출 — 마이그레이션 불필요하나 운영자 이메일이 공개되어 노출/스팸 우려.
2. `email` 로컬파트(@ 앞)만 표시 — 가벼우나 표시 이름을 운영자가 제어할 수 없음.
3. `User`에 표시 이름(`name`) 필드 추가 — 마이그레이션 필요하나 이메일을 감추고 운영자가 이름을 제어.

## 결정 (Decision)

`User` 모델에 **필수 문자열 `name`(표시 이름)** 필드를 추가하고, 이를 작성자 이름의 단일 출처로 삼는다.

- `Post`는 `author` 관계를 통해 `name`을 읽는다(별도 비정규화 컬럼 두지 않음 — 단순 1:N, 이름 변경 시 자동 반영).
- 공개 응답에는 `name`만 노출하고 `email`은 노출하지 않는다(이메일 비공개 유지).
- `PostSummaryDto`/`PostDetailDto`에 `authorName: string`을 추가한다(타입은 `packages/shared` 단일 정의 — 규칙 #5).
- 기존 데이터/시드 호환을 위해 `seedOperator`는 `name` 미지정 시 **email 로컬파트**를 기본값으로 사용한다(`OPERATOR_NAME` 환경변수로 재정의 가능). 마이그레이션은 기존 행의 `name`을 email 로컬파트로 백필한 뒤 NOT NULL을 건다.

## 결과 (Consequences)

긍정:
- 작성자 표시 이름을 운영자가 제어하며, 이메일은 공개되지 않는다.
- 작성자 정보의 출처가 `User.name` 하나로 고정된다(목록·상세 일관).
- `seedOperator` 기본값 덕분에 기존 테스트/시드 호출부를 수정하지 않아도 깨지지 않는다.

부정/비용:
- 스키마 마이그레이션 1건 추가(백필 포함). dev DB와 blog_test 양쪽에 적용 필요(`migrate dev` → `migrate deploy`).
- 향후 다중 작성자/필명 요구가 생기면 `name` 정책(고유성 등)을 재검토해야 한다.
