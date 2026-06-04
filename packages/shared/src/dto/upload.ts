// 미디어 업로드 결과 (ADR-0012 / ADR-0020). 반환 URL을 마크다운 본문에 임베드한다.
// type 은 MIME 첫 토큰('image' | 'video') 으로, 클라이언트 분기 보조 필드.
export interface UploadResultDto {
  url: string;
  contentType: string;
  size: number; // bytes
  type: 'image' | 'video';
}
