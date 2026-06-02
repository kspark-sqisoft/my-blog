# 유비쿼터스 언어 - my-blog

이 문서는 프로젝트에서 쓰이는 도메인 용어를 정의한다.
사용자 대화, 문서, 코드, DB 모두 이 정의를 따른다.

## Post (게시글)- 정의: 작성자가 발행한 글 한 건- 소속 Context: Publishing- 코드 표현: `Post` (Prisma 모델, `packages/api/prisma/schema.prisma`)- UI 표현: "게시글" 또는 "글"- 동의어 금지: Article, Entry, Document, Story 같은 단어 사용 금지

## Comment (댓글)- 정의: 특정 Post에 달리는 짧은 의견. 다른 Comment에 답글로 달릴 수 있다 (깊이 2까지: 최상위→답글→답글의 답글, 그 이상 금지 — ADR-0013)- 소속 Context: Conversation- 코드 표현: `Comment` (parentId 필드로 답글 관계 표현)- UI 표현: "댓글" / 답글은 "답글"- 동의어 금지: Reply, Note, Feedback

## Tag (태그)- 정의: Post를 분류하는 짧은 키워드. Post당 0~5개- 소속 Context: Publishing (Value Object - 독립 Aggregate 아님)- 코드 표현: `Tag` 모델 + `PostTag` 조인 테이블- UI 표현: "태그"

## Author (작성자)- 정의: Post 또는 Comment를 작성한 사용자- 주의: User와 다른 개념이 아니다. "User의 역할 중 하나"가 Author.- 소속 Context: Auth (User 자체) / Publishing (Post의 Author 관계)- 코드 표현: User 모델 + Post.authorId 외래키

## User (사용자)- 정의: 시스템에 가입한 사람. 이메일이 유일 식별자- 소속 Context: Auth- 코드 표현: `User` (Prisma 모델)- 동의어 금지: Member, Account (코드와 문서에서 통일)
