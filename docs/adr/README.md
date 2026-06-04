# Architecture Decision Records (ADR)

이 디렉터리는 my-blog의 아키텍처 결정 기록(Nygard 형식)을 담는다.
Accepted ADR은 IMMUTABLE — 결정이 바뀌면 새 ADR이 기존 것을 supersede 한다.

| 번호 | 제목 | 상태 | 작성일 | 한 줄 요약 | 링크 |
|---|---|---|---|---|---|
| 0016 | 프론트 디자인 시스템을 CSS 변수 토큰 + data-theme 수동 토글로 구성 | Proposed | 2026-06-04 | 시맨틱 토큰+`ab-*` 클래스, 다크는 `[data-theme]`, useTheme로 토글·보존 | [링크](0016-frontend-design-tokens-theme.md) |
| 0015 | 목록 요약·대표 이미지를 저장 컬럼 없이 본문에서 파생 | Proposed | 2026-06-04 | 본문 첫 이미지=대표 이미지, 요약 평문화. 읽기 시 파생(마이그레이션 없음) | [링크](0015-cover-image-derived-from-content.md) |
| 0014 | CI 파이프라인으로 GitHub Actions 채택 | Accepted | 2026-06-02 | PR/푸시에 lint·typecheck·단위·api-e2e·web-e2e Job 분리 자동화 | [링크](0014-ci-github-actions.md) |
| 0013 | Comment 답글을 2단계(깊이 2)까지 허용 | Accepted | 2026-06-02 | 답글의 답글까지 허용, 깊이 2 초과 거부. ADR-0007을 supersede | [링크](0013-comment-two-level-replies.md) |
| 0012 | 이미지 업로드를 저장소 추상화로 구현 (로컬 → S3) | Accepted | 2026-06-02 | StorageProvider 추상화로 로컬 저장, 마크다운 URL 임베드, S3 확장 가능 | [링크](0012-image-upload-storage-abstraction.md) |
| 0011 | Docker Compose를 베이스 + dev/prod 오버라이드로 분리하고 멀티스테이지 빌드 채택 | Accepted | 2026-06-02 | 베이스+dev/prod 3파일, 멀티스테이지, DB healthcheck로 api 기동 게이트 | [링크](0011-docker-compose-base-dev-prod-overrides.md) |
| 0010 | Post 목록 페이지네이션을 offset/page 기반으로 채택 | Accepted | 2026-06-02 | 저볼륨 1인 블로그라 단순한 offset/page 페이지네이션 채택 | [링크](0010-offset-pagination.md) |
| 0009 | 익명 Comment 스팸 방지로 throttler + 길이 제한 채택 | Accepted | 2026-06-02 | 가입·캡차 없이 레이트 리밋과 본문 길이 상한으로 도배 억제 | [링크](0009-anonymous-comment-spam-protection.md) |
| 0008 | API 스타일로 REST 채택 | Accepted | 2026-06-02 | 자원 중심 단순 도메인이라 GraphQL 대신 REST(/api, JSON) | [링크](0008-rest-api.md) |
| 0007 | Comment 1단계 답글을 애플리케이션 계층에서 강제 | Superseded by ADR-0013 | 2026-06-02 | 자기참조 스키마 유지, 깊이 1 제약은 서비스 계층에서 검증 (→ 0013으로 대체) | [링크](0007-comment-single-level-reply-enforcement.md) |
| 0006 | Tag를 별도 테이블 + PostTag 조인으로 모델링 | Accepted | 2026-06-02 | glossary대로 Tag 테이블 + PostTag 조인으로 정규화·탐색 효율 | [링크](0006-tag-join-table-modeling.md) |
| 0005 | 발행 상태를 enum + publishedAt으로 표현 | Accepted | 2026-06-02 | PostStatus enum과 publishedAt으로 상태·발행일·정렬 지원 | [링크](0005-post-status-enum-publishedat.md) |
| 0004 | 공유 타입은 순수 TS 계약, 검증은 각 패키지 | Accepted | 2026-06-02 | shared는 타입 계약만, 검증은 api=class-validator·web=zod 각자 | [링크](0004-shared-pure-ts-type-contracts.md) |
| 0003 | Post 본문을 마크다운으로 저장하고 렌더 시 새니타이즈 | Accepted | 2026-06-02 | 마크다운 원문 저장, react-markdown + rehype-sanitize로 XSS 차단 | [링크](0003-post-content-markdown-sanitize.md) |
| 0002 | 운영자 계정을 시드 스크립트 + 환경변수로 부트스트랩 | Accepted | 2026-06-02 | 공개 가입 없이 시드+환경변수로 운영자 1인 계정 생성 | [링크](0002-operator-account-seed-bootstrap.md) |
| 0001 | 운영자 JWT를 httpOnly 쿠키로 저장 | Accepted | 2026-06-02 | XSS 토큰 탈취 방지 위해 httpOnly+Secure+SameSite 쿠키 사용 | [링크](0001-jwt-httponly-cookie.md) |
