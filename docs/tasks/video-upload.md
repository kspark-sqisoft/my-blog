# video-upload — 본문 비디오(MP4) 업로드

> 정규 소스는 `feature_list.json`. 이 문서는 미러다(절대 규칙 #10).
> 근거: ADR-0020 / PRD: `docs/prd/video-upload.md` / TRD: `docs/trd/video-upload.md`.

## 배경
이미지 업로드(ADR-0012) 의 패턴을 그대로 확장해 MP4 비디오를 같은 엔드포인트로 받는다.
서버에 ffmpeg 등 의존을 추가하지 않고, 마크다운/스키마/Domain Event 도 그대로 둔다.
클라이언트가 URL 확장자로 `<video>`/`<img>` 를 분기한다.

## 태스크

#### T-PUB-201 — shared UploadResult 확장 + 환경변수 추가
- priority: 51 / 의존: 없음 / status: done (2026-06-04)
- 산출:
  - `packages/shared/src/dto/upload.ts` 의 `UploadResultDto` 에 `type: 'image' | 'video'` 추가.
  - `.env.example` 에 `UPLOAD_MAX_BYTES_VIDEO=52428800` 추가.
  - `docker-compose.yml` api environment 에 `UPLOAD_MAX_BYTES` / `UPLOAD_MAX_BYTES_VIDEO` 매핑.
  - `upload.controller.ts` 응답에 `type: 'image'` 임시 고정(T-PUB-202 에서 분기 확장).
  - 회귀 가드 단위 spec: `upload-result.type.spec.ts`.
- acceptance:
  1. `packages/shared` 에서 `UploadResultDto` 가 `{ url, contentType, size, type: 'image'|'video' }` 로 export. ✅
  2. `.env.example` 에 `UPLOAD_MAX_BYTES_VIDEO` 라인 추가, 기본값 52428800. ✅
  3. docker-compose api environment 에 `UPLOAD_MAX_BYTES_VIDEO: ${UPLOAD_MAX_BYTES_VIDEO}` 매핑. ✅

#### T-PUB-202 — api `/api/uploads` 가 MP4 수락 + MIME/크기 분리 검증
- priority: 52 / 의존: T-PUB-201 / status: done (2026-06-04)
- 산출:
  - `upload.controller.ts`: `ALLOWED_MIME` 에 `video/mp4` 추가, `mediaFileFilter` 로 리네이밍.
  - `resolveMediaType()` 헬퍼: MIME 첫 토큰 → `type: 'image'|'video'`.
  - 크기 한도 분기: 비디오 `UPLOAD_MAX_BYTES_VIDEO`(env / fallback 50MB), 이미지 `UPLOAD_MAX_BYTES`(env / fallback 5MB).
  - `upload.e2e-spec.ts` 5 신규 케이스: MP4 201/type, 비디오 413, **MIME 별 분리 한도 회귀 가드**, MOV 400, MEMBER 403.
- acceptance:
  1. 50MB 이하 MP4 업로드 → 201 + `contentType: 'video/mp4'` + `type: 'video'`. ✅
  2. 비디오 한도 초과 → 413, 이미지 한도 6MB JPG → 413 (분리 유지). ✅
  3. ZIP/MOV/WebM 등 비허용 MIME → 400. ✅
  4. 비인증 401 (기존), MEMBER 403 (강등 후 검증). ✅

#### T-PUB-203 — api e2e: 정적 서빙 Range 응답 + Content-Type
- priority: 53 / 의존: T-PUB-202 / status: done (2026-06-04)
- 산출:
  - `test/upload.e2e-spec.ts` 2 신규 케이스: 비디오 왕복(쓰기→읽기 + Content-Type + Accept-Ranges) / Range bytes=0-99 → 206 + 100바이트.
  - 코드 변경 0 — `useStaticAssets`(express.static) 의 기본 동작이 그대로 통과. 회귀 가드만 추가.
- acceptance:
  1. 업로드된 비디오 URL `GET` → 200 + `Content-Type: video/mp4` + `Accept-Ranges: bytes`. ✅
  2. `Range: bytes=0-99` 요청 → 206 Partial Content + `Content-Length: 100` + 100바이트. ✅
  3. 절대 규칙 #9 (쓰기-읽기 왕복) 통과. ✅

#### T-WEB-201 — web 마크다운 렌더러 `.mp4` → `<video>` 자동 분기
- priority: 54 / 의존: T-PUB-202 / status: done (2026-06-04)
- 산출:
  - `packages/web/src/components/Markdown.tsx`: `MediaNode` 컴포넌트 추가.
    `ReactMarkdown` 의 `components={{ img: MediaNode }}` 로 마크다운 이미지 노드를 url 확장자에 따라
    `<video>`/`<img>` 분기. 비디오는 `controls preload="metadata" playsInline aria-label={alt}`.
  - `Markdown.test.tsx` 6 신규 케이스: `.mp4` <video>, autoplay 없음, .jpg/png/gif/webp 는 <img>, aria-label 매핑, raw <video> 차단.
- acceptance:
  1. `![demo](/uploads/x.mp4)` → `<video controls preload="metadata" playsInline>`. ✅
  2. `![photo](/uploads/x.{jpg,png,gif,webp})` → 기존 `<img>`. ✅
  3. autoplay 없음. ✅
  4. raw `<video>` 텍스트 입력은 sanitize/미파싱으로 차단. ✅

#### T-WEB-202 — web 글 에디터 미디어 업로드 UX (이미지+비디오 통합)
- priority: 55 / 의존: T-WEB-201 / status: done (2026-06-04)
- 산출:
  - `PostEditor.tsx`: 패널 라벨 "커버 이미지" → "미디어", 힌트 갱신, input `id="media" aria-label="미디어 업로드" accept="image/*,video/mp4"`.
  - `ALLOWED_UPLOAD_MIME` 화이트리스트(api 와 한 쌍): jpeg/png/gif/webp + mp4. `handleUpload` 가 `file.type` 으로 한 번 더 검증해 비허용 차단 + setError.
  - 본문 삽입 마크다운은 이미지/비디오 동일하게 `![alt](url)`.
  - `PostEditor.test.tsx` +4 케이스: accept 속성, MP4 ![alt](url) 삽입, PDF 차단, MOV(video/quicktime) 차단.
- acceptance:
  1. `accept="image/*,video/mp4"` + 라벨 "미디어 업로드". ✅
  2. MP4 업로드 → 본문에 `![demo.mp4](/uploads/clip.mp4)` 한 줄 삽입. ✅
  3. PDF/MOV 등 비허용 → 클라이언트 알림 + 업로드 호출 없음. ✅

#### T-WEB-203 — web 목록 카드 비디오 첫 프레임 커버
- priority: 56 / 의존: T-WEB-201 / status: todo
- 산출:
  - 글 목록 카드(`PostCard` 또는 동등 컴포넌트)가 `coverImageUrl` 의 확장자가 `.mp4` 면
    `<video src preload="metadata" muted playsInline>` 로 렌더(controls 없음, 카드 인라인 재생 X).
  - 그 외 확장자는 기존 `<img>` 그대로.
- acceptance:
  1. 본문 첫 미디어가 `.mp4` 인 글은 카드에 첫 프레임이 멈춰 보인다.
  2. 카드 클릭 시 상세로 이동 — 카드 인라인 재생 안 함.
  3. 본문 첫 미디어가 이미지면 기존 동작 그대로.

## 범위 외
- WebM/MOV 포맷, 트랜스코딩, HLS·DASH.
- 서버 ffmpeg 썸네일 추출.
- 자동재생, 자막/track, 외부 비디오 임베드(YouTube).
- 비디오-Post 연관 추적/미사용 파일 정리(이미지와 통합 후속).
