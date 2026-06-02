import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Injectable } from '@nestjs/common';
import { SavedFile, StorageProvider, StoredFile } from './storage.provider';

// MIME → 확장자 폴백 (originalName에 확장자가 없거나 안전하지 않을 때)
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

// 로컬 디스크 저장 (ADR-0012). 저장 경로/URL 베이스는 환경변수로 주입.
@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly dir = process.env.UPLOAD_DIR ?? './uploads';
  private readonly urlBase = (
    process.env.UPLOAD_URL_BASE ?? '/uploads'
  ).replace(/\/+$/, '');

  async save(file: StoredFile): Promise<SavedFile> {
    const ext = this.safeExtension(file.originalName, file.mimeType);
    // 추측 불가능한 파일명 (originalName은 확장자만 사용 → traversal 차단)
    const name = `${randomBytes(16).toString('hex')}${ext}`;

    const baseResolved = path.resolve(this.dir);
    const target = path.resolve(baseResolved, name);
    // 이중 안전장치: 베이스 디렉터리 밖이면 거부
    if (target !== path.join(baseResolved, name)) {
      throw new Error('잘못된 저장 경로입니다.');
    }

    await mkdir(baseResolved, { recursive: true });
    await writeFile(target, file.buffer);

    return { url: `${this.urlBase}/${name}` };
  }

  // 확장자를 안전하게 추출(영숫자만), 없으면 MIME에서 폴백
  private safeExtension(originalName: string, mimeType: string): string {
    const ext = path.extname(originalName).toLowerCase();
    if (/^\.[a-z0-9]+$/.test(ext)) {
      return ext;
    }
    return MIME_EXT[mimeType] ?? '';
  }
}
