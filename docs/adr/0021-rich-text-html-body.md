# ADR-0021: 본문을 마크다운에서 sanitize 된 HTML 로 (ADR-0003 supersede)

## 상태 (Status)

Proposed - 2026-06-04 — supersedes ADR-0003

## 컨텍스트 (Context)

ADR-0003 은 본문을 마크다운으로 한정해 XSS 표면을 작게 두고, 작성자 도구를 단순화했다. 운영 중
"일부 단어/문장에 즉시 색/크기 강조를 주고 싶다"는 요구가 누적됐고, 이는 표준 마크다운에 없는 시각
서식이다. 마크다운 위에 비표준 syntax 를 얹기보다, **WYSIWYG 에디터 + sanitize 된 HTML** 로 본문
모델 자체를 갈아엎는 것이 더 단순하다.

평가 기준: 작성자 UX(결과 즉시 확인, 학습 비용↓), 보안(XSS 차단), 변경 비용(마이그레이션·렌더링·
파생값), 외부 의존성 안정성.

## 결정 (Decision)

본문 모델을 **마크다운 → sanitize 된 HTML** 로 전환한다.

- 에디터: **TipTap**(`@tiptap/react`, ProseMirror 기반). 가장 활발한 커뮤니티, 헤드리스, 확장 용이.
- 저장: `Post.contentHtml` 컬럼 추가. `contentMarkdown` 은 과도기 보존(롤백 안전망) 후 후속에서 제거.
- sanitize: 서버 `sanitize-html` + 클라이언트 `dompurify`. 화이트리스트는 `packages/shared` 의
  `richHtmlSchema` 한 곳. 인라인 `style` 금지 — 색/크기는 **Tailwind 클래스 화이트리스트**로만.
- 마이그레이션: 일회성 스크립트가 기존 contentMarkdown 을 `markdown-it` 으로 HTML 변환, `.mp4`
  확장자 `<img>` 를 `<video>` 노드로 후처리, sanitize 통과시켜 contentHtml 에 저장.
- 본문 파생값(요약/대표 미디어) 은 `cheerio` 로 HTML 을 파싱해 만든다(api 의 PostSummary 빌드).
- 응답·요청 DTO 에서 `contentMarkdown` 키는 제거(과도기 응답에도 포함하지 않음). 입력은 `contentHtml` 만.
- 색/크기는 화이트리스트 프리셋만 허용 — 8색 팔레트 + 4단 크기. 임의 hex/px 입력은 후속 ADR.

ADR-0003 의 "본문은 마크다운" 결정은 본 ADR 로 supersede 한다.

## 결과 (Consequences)

긍정:
- 작성자가 결과를 보면서 쓰고, 학습 비용이 줄어든다.
- 색/크기 같은 시각 강조가 기본 도구가 된다.
- 본문 표현력이 HTML 화이트리스트만큼 확장된다(표·캡션 등 후속 확장 용이).

부정/감수해야 할 것:
- XSS 표면 확대 — 서버 sanitize 게이트가 반드시 통과해야 한다. 화이트리스트 변경은 review 필수.
- 마이그레이션 위험 — 기존 글이 변환 결과로 살짝 다르게 보일 수 있다(headings/list 마진 등 CSS 영향).
- 의존성 추가 — TipTap, sanitize-html, dompurify, markdown-it(일회성), cheerio. 번들/이미지 크기↑.
- 외부 도구(검색·요약 ML 등) 입장에서는 마크다운보다 HTML 처리가 약간 복잡. 우리 서버가 파싱 책임.

## 검토 시점

다음 트리거 발생 시 본 ADR 을 재평가한다:
- 글 이력/버전, 협업 편집(yjs) 도입 요구.
- 임의 hex/px 입력 요구(현재 프리셋 한정) — 화이트리스트 정책 재평가.
- 표(table)/임베드 카드(YouTube 등) — Table/Embed 확장 채택 여부.
- TipTap 메이저 호환성 깨짐.
