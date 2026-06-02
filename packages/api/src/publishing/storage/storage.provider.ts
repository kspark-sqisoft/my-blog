// 저장소 추상화 (ADR-0012). 로컬 → S3 확장은 구현체 교체로.
export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface SavedFile {
  url: string;
}

// Nest DI 토큰으로도 사용하는 추상 클래스
export abstract class StorageProvider {
  abstract save(file: StoredFile): Promise<SavedFile>;
}
