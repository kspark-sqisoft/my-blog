# @blog/web - React 프론트엔드

## 명령- 개발: `pnpm	dev` (포트 5173)- 빌드: `pnpm	build`- 테스트: `pnpm	test` (Vitest)- E2E: `pnpm	test:e2e` (Playwright)

## 아키텍처- Vite + React 18 + TypeScript- 라우팅: React Router v6 (file-based 아님, 명시적 routes/)- 서버 상태: TanStack Query (절대 useEffect+fetch 금지)- 클라이언트 상태: Zustand (Context 남용 금지)- 폼: react-hook-form + Zod (packages/shared 의 스키마 재사용)- 스타일: Tailwind. 인라인 style 금지

## 디렉토리- src/pages/

— 라우트 컴포넌트- src/components/ — 재사용 UI (도메인 별 폴더)- src/api/
— TanStack Query 훅. 도메인별 파일- src/lib/ - e2e/
— 유틸리티
— BDD 시나리오 (Given-When-Then 형식)

## 절대 규칙- API 호출은 반드시 src/api/ 의 훅을 통해. 컴포넌트에서 직접 fetch 금지- 폼 검증은 반드시 packages/shared 의 Zod 스키마로- 컴포넌트 파일은 한 컴포넌트만 export- 새 사용자 여정은 e2e/ 에 Given-When-Then 시나리오부
