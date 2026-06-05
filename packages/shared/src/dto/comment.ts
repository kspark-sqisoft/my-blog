// 댓글 (ADR-0013: 깊이 2까지 중첩)
export interface CommentDto {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number; // 0=최상위, 1=답글, 2=답글의 답글
  userId: string | null; // 로그인 회원 작성자 (ADR-0018). 익명은 null
  authorName: string | null; // 표시 이름: 로그인=계정 이름, 익명=displayName, 둘 다 없으면 null
  authorAvatarUrl: string | null; // 작성자 아바타 URL (ADR-0025). 익명·미설정은 null
  displayName: string | null; // 익명 입력 이름(하위호환). 프론트는 authorName 우선
  body: string;
  createdAt: string; // ISO 8601
  replies: CommentDto[];
}

// 작성 (익명 가능)
export interface CreateCommentDto {
  body: string;
  displayName?: string;
  parentId?: string;
}
