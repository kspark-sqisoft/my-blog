// 참여(Engagement) 지표 응답 계약 (ADR-0024).

// 좋아요 토글 결과: 현재 누적 좋아요 수 + 요청자가 누른 상태인지.
export interface LikeStateDto {
  likeCount: number;
  likedByMe: boolean;
}

// 조회 기록 결과: 현재 누적 조회수.
export interface ViewCountDto {
  viewCount: number;
}
