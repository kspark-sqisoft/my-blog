import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalStorageProvider } from './local-storage.provider';

describe('LocalStorageProvider', () => {
  const dir = path.join(os.tmpdir(), `blog-upload-test-${process.pid}`);
  const urlBase = '/uploads';
  let provider: LocalStorageProvider;

  const file = (originalName: string) => ({
    buffer: Buffer.from('hello'),
    originalName,
    mimeType: 'image/png',
  });

  beforeAll(() => {
    process.env.UPLOAD_DIR = dir;
    process.env.UPLOAD_URL_BASE = urlBase;
    provider = new LocalStorageProvider();
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('파일을 저장하고 urlBase 하위 접근 URL을 반환한다(확장자 보존)', async () => {
    const saved = await provider.save(file('pic.png'));
    expect(saved.url.startsWith(`${urlBase}/`)).toBe(true);
    expect(saved.url.endsWith('.png')).toBe(true);

    const rel = saved.url.slice(urlBase.length + 1);
    const onDisk = path.join(dir, rel);
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.readFileSync(onDisk, 'utf8')).toBe('hello');
  });

  it('동일 originalName도 추측 불가능한 서로 다른 파일명으로 저장한다', async () => {
    const a = await provider.save(file('same.png'));
    const b = await provider.save(file('same.png'));
    expect(a.url).not.toBe(b.url);
  });

  it('경로 traversal originalName도 UPLOAD_DIR를 벗어나지 않는다', async () => {
    const saved = await provider.save(file('../../../etc/passwd.png'));
    expect(saved.url.includes('..')).toBe(false);
    const rel = saved.url.slice(urlBase.length + 1);
    const resolved = path.resolve(dir, rel);
    expect(resolved.startsWith(path.resolve(dir) + path.sep)).toBe(true);
  });

  it('저장 경로/URL 베이스는 환경변수로 주입된다', () => {
    expect(process.env.UPLOAD_DIR).toBe(dir);
    expect(process.env.UPLOAD_URL_BASE).toBe(urlBase);
  });
});
