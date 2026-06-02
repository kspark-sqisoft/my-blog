// 이미지 업로드 결과 (ADR-0012). 반환 URL을 마크다운에 임베드.
export interface UploadResultDto {
  url: string;
  contentType: string;
  size: number; // bytes
}
