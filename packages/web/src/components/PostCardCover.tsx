// 카드 커버 미디어. 목록(PostListView)·관련 글(RelatedPosts) 공용.
// coverImageUrl 이 .mp4 면 첫 프레임 <video>(ADR-0020), 이미지면 <img>, 없으면 플레이스홀더.
const VIDEO_COVER_EXT = /\.mp4(?:\?|#|$)/i;

export function PostCardCover({
  coverImageUrl,
}: {
  coverImageUrl: string | null;
}) {
  if (!coverImageUrl) {
    return <div className="ab-ph ab-card-cover" />;
  }
  if (VIDEO_COVER_EXT.test(coverImageUrl)) {
    // 비디오 커버: 첫 프레임만 표시(controls 없음 → 카드 클릭은 상세 이동만).
    return (
      <video
        className="ab-card-cover"
        src={coverImageUrl}
        preload="metadata"
        muted
        playsInline
      />
    );
  }
  return (
    <img className="ab-card-cover" src={coverImageUrl} alt="" loading="lazy" />
  );
}
