# TRD - 본문 비디오 업로드 (이미지 업로드 확장)

> 입력: `docs/prd/video-upload.md`, ADR-0020. ADR-0012 의 StorageProvider/마크다운 임베드
> 패턴 위에 비디오를 더한다.

## 핵심 기술 결정

| # | 결정 | 선택 |
|---|---|---|
| ① | 엔드포인트 | **단일 `POST /api/uploads`** 가 이미지+비디오를 모두 받는다 (분리 X) |
| ② | MIME 화이트리스트 | 이미지 5종 (`image/jpeg|png|gif|webp`) + **`video/mp4` 1종** |
| ③ | 크기 상한 | 이미지/비디오 **분리 env** — `UPLOAD_MAX_BYTES`(5MB) / `UPLOAD_MAX_BYTES_VIDEO`(50MB) |
| ④ | 본문 표기 | 기존 마크다운 `![alt](url)` 그대로. 확장자(.mp4)로 렌더러가 `<video>`/`<img>` 자동 분기 |
| ⑤ | 목록 썸네일 | `<video preload="metadata" muted playsInline>` 의 **첫 프레임**. ffmpeg 의존 0 |
| ⑥ | 정적 서빙 | 기존 express static 그대로 — `Accept-Ranges: bytes` 자동(`<video>` 시킹용) |
| ⑦ | 응답 모양 | `{ url, contentType, size, type: 'image' \| 'video' }` 으로 `type` 추가(클라 분기 보조) |

## 공유 타입 변경 (packages/shared)

```ts
// 기존 UploadResult 확장
export interface UploadResult {
  url: string;
  contentType: string;
  size: number;
  type: 'image' | 'video'; // 신규 — MIME 첫 토큰 기반
}
```

`UploadResult` 가 없었다면 신설(현재는 inline). `PostSummaryDto.coverImageUrl` 의 의미는 그대로
유지(이름 미변경)하되, 값이 `.mp4` 면 클라이언트가 비디오로 렌더(NF: 마이그레이션 없음).

## API 변경

### `POST /api/uploads` (변경 — `@Roles('AUTHOR','ADMIN')` 유지)

```
요청: multipart/form-data; file=<이미지|비디오>
응답 201:
  - 이미지: { url, contentType: 'image/jpeg' 등, size, type: 'image' }
  - 비디오: { url, contentType: 'video/mp4',     size, type: 'video' }
오류:
  - 400: MIME 화이트리스트 외 (`type/* not allowed`)
  - 413: 비디오 50MB 초과 / 이미지 5MB 초과 (이미지/비디오 분리 한도)
  - 401/403: 미인증/권한 없음
```

multer 설정은 화이트리스트(`fileFilter`) + `limits.fileSize` 를 **요청 단위 동적**으로 적용한다.
multer `limits.fileSize` 는 정적이라, 더 큰 비디오 상한을 적용한 뒤 `fileFilter`/스토리지 후
검증에서 MIME 별 상한을 다시 검증(`if image && size>IMAGE_MAX -> 413`).

### 정적 서빙 (변경 0)

`ServeStaticModule` (또는 NestJS `useStaticAssets`) 가 `/uploads/*` 를 그대로 서빙. express
`send` 가 `Range` 헤더를 처리해 `206 Partial Content` 를 자동 응답한다. 별도 코드 없음.

## 웹 변경 (packages/web)

| 컴포넌트 | 변경 |
|---|---|
| `markdown/render.tsx` (또는 Post 본문 렌더러) | 이미지 노드의 url 이 `.mp4` 면 `<video controls preload="metadata" playsInline>` 로 치환. alt 는 `aria-label` 로 |
| `pages/admin/PostEditor.tsx` | "이미지 업로드" → "미디어 업로드". `<input accept="image/*,video/mp4">`, 업로드 응답의 `type` 무관하게 마크다운에 그대로 `![alt](url)` 삽입 |
| `components/PostCard.tsx` (또는 목록 카드) | `coverImageUrl` 이 `.mp4` 면 `<video src preload="metadata" muted playsInline>` 로, 그 외엔 기존 `<img>`. 카드 자체는 클릭 시 상세 이동만, 인라인 재생 X |
| `index.css` (또는 토큰) | `.card-media video { object-fit: cover }` 등 비디오/이미지 공통 박스 |

마크다운 sanitize(ADR-0003) 는 본문이 항상 `![](url)` 형태로 들어오므로 새 태그 허용 정책 변경 없음.
HTML `<video>` raw 입력은 sanitize 가 계속 거부한다(렌더 단계에서만 변환).

## 환경 변수

```ini
# .env.example 추가
UPLOAD_MAX_BYTES_VIDEO=52428800   # 50MB
# UPLOAD_MAX_BYTES=5242880 (기존)
```

## 테스트 전략

- **api unit**: `upload.controller.spec` (없으면 신설) — MIME 별 분기, 크기 분리 한도, 응답 `type` 필드.
- **api e2e** `test/upload.e2e-spec.ts` 확장:
  - 50MB 미만 MP4 업로드 201 + `Content-Type: video/mp4` + `type: 'video'`
  - 51MB MP4 413
  - 6MB JPG 413 (이미지 한도 그대로)
  - `Range: bytes=0-99` 요청에 206 + `Content-Range` 응답
- **web unit**: `markdown` 렌더러 spec — `.mp4` URL 입력이 `<video>` DOM 으로 그려지는지.
- **web Playwright** (격리 스택): 작성자 흐름 — 에디터에서 MP4 업로드 → 발행 → 상세에서
  `<video>` 요소 존재 + `play()` 가능, 목록에서 카드 비디오가 자동재생되지 않음.

## 보안 처리

- MIME 와 확장자 **양쪽** 검증(확장자 위조 차단). 최종 저장 파일명은 기존처럼 추측 불가 hex.
- `<video>` 의 `src` 는 본문에서 마크다운으로 통제 — 외부 URL 도 허용 정책은 기존 `<img>` 와
  동일(ADR-0003 의 sanitize 정책). 새 우회 경로를 만들지 않는다.
- 자동재생 금지 → drive-by 트래픽/배터리 소모 회피.
