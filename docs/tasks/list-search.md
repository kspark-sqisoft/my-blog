# list-search — 리스트 키워드 검색

> 정규 소스는 `feature_list.json`. 이 문서는 미러다(절대 규칙 #10).

## 배경
공개 글 목록에서 제목·본문 키워드로 빠르게 글을 찾는다. 입력 즉시(디바운스) 검색되고,
검색창을 비우면 전체 목록이 돌아온다.

## 태스크

#### T-WEB-308 — 리스트 제목·본문 키워드 검색
- priority: 69 / 의존: T-PUB-004 / status: done (2026-06-05)
- acceptance:
  1. `GET /api/posts?q=` 로 제목·본문(평문 contentMarkdown) 부분일치 검색(대소문자 무시). q 비면 전체.
  2. 리스트 검색 입력 → `useDebouncedValue(300ms)` 후 조회, 비우면 전체 복원.
  3. 검색어를 URL `?q=` 에 반영(공유/새로고침 보존), q 변경 시 1페이지로 리셋.
  4. 회귀 없음: api(post.service 29 / post e2e 20) + web(unit 97 / e2e 7) 통과.

## 구현 메모
- 백엔드: `ListPostsQueryDto.q`(IsString, MaxLength 100) + `PostService.listPublished` where 에
  `q.trim()` 있으면 `OR: [title contains q, contentMarkdown contains q]`(insensitive). 서버 코드 한 곳.
- 프론트: `lib/useDebouncedValue.ts`(범용 디바운스 훅) + `PostList` 검색 입력. URL 반영 effect 는
  `appliedQ` ref 로 마지막 적용값 비교(deps=[debounced]) — searchParams churn 으로 입력이 막히는 것 방지.

## 범위 외
- 태그/작성자 필터 결합 UI, 검색 하이라이트, 전문(full-text) 인덱스. (현재는 LIKE 부분일치)
