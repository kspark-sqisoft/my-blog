# ADR-0016: 프론트 디자인 시스템을 CSS 변수 토큰 + data-theme 수동 토글로 구성

## 상태 (Status)

Accepted - 2026-06-04

## 컨텍스트 (Context)

claude.ai/design의 애플 스타일 시안("디버그 노트")을 `packages/web`에 적용한다. 시안은 시맨틱 색 토큰과 라이트/다크 두 테마, 사용자가 **직접 전환**하는 토글을 전제로 한다. 기존 프론트는 Tailwind v4(CSS 기반 설정, `@import 'tailwindcss'`)를 쓰고 "인라인 style 금지" 규칙이 있다. 디자인을 어떤 스타일 메커니즘으로, 다크 모드를 어떤 방식으로 구현할지 정해야 한다.

평가 기준: 시안과의 시각 정합(픽셀), Tailwind v4와의 공존, 라이트/다크 **수동** 토글 + 선택 보존 요구, "인라인 style 금지" 준수, 한 곳에서의 테마 전환.

## 결정 (Decision)

디자인을 **시맨틱 CSS 변수 토큰 + `[data-theme]` 속성 기반 수동 테마 토글**로 구현한다.

- `index.css`에 `@import 'tailwindcss'`를 유지하고, 그 위에 시맨틱 토큰(`--bg/--surface/--text/--accent/--border/...`)과 컴포넌트용 `ab-*` 클래스를 정의한다.
- 다크 테마는 `[data-theme='dark']` 블록에서 동일 토큰을 재정의한다(`prefers-color-scheme` 자동이 아니라 사용자 토글).
- `useTheme`(zustand)이 `document.documentElement[data-theme]`와 localStorage `blog-theme`를 동기화한다(기본 light, 선택 보존).
- 컴포넌트는 `ab-*` 시맨틱 클래스를 사용해 인라인 style을 쓰지 않는다.

## 결과 (Consequences)

긍정:
- 토큰 한 세트로 라이트/다크를 한 곳에서 전환 — 컴포넌트는 색을 직접 알지 않는다.
- Tailwind v4와 공존(유틸리티는 그대로 쓰되, 디자인 토큰/복합 컴포넌트는 `ab-*`로 표현).
- 사용자 수동 토글 + 보존 요구를 정확히 충족하고, 시안의 시맨틱 토큰 구조를 그대로 옮겨 시각 정합이 높다.

부정/감수해야 할 것:
- 전역 스타일시트(`index.css`)가 커진다(토큰 + 컴포넌트 클래스 다수).
- Tailwind 유틸리티 클래스와 커스텀 `ab-*` 클래스가 공존해 스타일 소스가 두 갈래가 된다.
- 테마가 `data-theme` 속성에 의존하므로 SSR/초기 페인트 시 속성 주입 타이밍을 신경 써야 한다(현재 CSR이라 모듈 로드시 1회 적용).

## 검토 시점

테마가 2개를 넘어가거나(고대비 등), 디자인 토큰을 패키지로 공유해야 하거나, 전역 CSS 규모가 유지보수에 부담이 되면 토큰 패키지화 또는 CSS-in-JS/Tailwind 테마 플러그인 전환을 재평가한다.
