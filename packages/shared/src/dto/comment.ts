// 댓글 (ADR-0013: 깊이 2까지 중첩)
export interface CommentDto {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number; // 0=최상위, 1=답글, 2=답글의 답글
  displayName: string | null;
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
