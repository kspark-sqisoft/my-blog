// dev 시드: noa99kee@gmail.com 에게 개발 관련 글 30건을 PUBLISHED 로 추가한다.
// 실행: docker exec my-blog-api-1 sh -c 'cd /repo/packages/api && pnpm tsx prisma/seed-dev-posts.ts'

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { slugify } from '../src/publishing/slugify';

const AUTHOR_EMAIL = 'noa99kee@gmail.com';

interface Seed {
  title: string;
  contentHtml: string;
  tags: string[];
}

const POSTS: Seed[] = [
  {
    title: 'useMemo 는 언제 진짜 필요한가',
    tags: ['react', 'performance'],
    contentHtml: `
<p>memoization 도 비용이다. 의존성 비교만으로도 컴포넌트 트리가 깊을수록 보이지 않는 오버헤드가 쌓인다.</p>
<h2>실제로 필요한 경우</h2>
<ul><li>자식에게 동일 참조를 넘겨야 할 때(<code>React.memo</code> 와 짝)</li><li>useEffect 의 deps 안에 들어가는 객체·배열을 안정화할 때</li><li>측정 ms 단위로 무거운 계산</li></ul>
<h2>대부분은 필요 없다</h2>
<p>객체 리터럴, map/filter, 짧은 배열 sort 는 매번 다시 만들어도 비용이 거의 없다. 먼저 측정하고, 측정값이 말할 때만 메모화한다.</p>`,
  },
  {
    title: 'TypeScript 의 satisfies 가 해결하는 문제',
    tags: ['typescript'],
    contentHtml: `
<p><code>as</code> 는 타입을 강제하고, 타입 어노테이션은 너무 일반화한다. <code>satisfies</code> 는 "이 값이 X 를 만족함을 검증하되, 더 좁은 리터럴 타입은 보존" 하는 절충안이다.</p>
<pre><code class="language-typescript">const routes = {
  home: { path: '/', auth: false },
  admin: { path: '/admin', auth: true },
} satisfies Record&lt;string, { path: string; auth: boolean }&gt;;
// routes.home.path 는 '/' 리터럴 그대로 추론된다
</code></pre>
<p>설정 객체, 라우트 맵, 상수 테이블에 특히 잘 맞는다.</p>`,
  },
  {
    title: 'Docker Compose dev/prod 분리 패턴',
    tags: ['docker', 'devops'],
    contentHtml: `
<p>한 파일에 환경별 if 를 박지 말고, base + overlay 로 쪼갠다.</p>
<pre><code class="language-bash">docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d</code></pre>
<h2>왜 좋은가</h2>
<ul><li>base 는 단일 진실원천 — 이미지·네트워크·볼륨 정의</li><li>overlay 는 dev 한정 바인드 마운트·핫리로드·디버거 포트</li><li>prod 빌드는 base 만 — 실수로 dev 마운트가 섞이지 않는다</li></ul>`,
  },
  {
    title: 'Prisma 트랜잭션, $transaction 두 가지 모드',
    tags: ['prisma', 'postgres'],
    contentHtml: `
<p>배열 모드(<code>$transaction([...])</code>)는 단순 batch — 순차 실행 + 한 트랜잭션. 콜백 모드(<code>$transaction(async (tx) =&gt; ...)</code>)는 그 안에서 조건 분기·비동기 작업이 가능하다.</p>
<h2>주의</h2>
<p>콜백 모드는 기본 5s 타임아웃. 무거운 작업이 섞이면 <code>maxWait</code>, <code>timeout</code> 을 명시적으로 늘려야 한다. 외부 API 호출은 트랜잭션 밖으로 빼라 — 락을 오래 잡으면 다른 요청이 멈춘다.</p>`,
  },
  {
    title: 'NestJS Pipe vs Guard vs Interceptor 한 페이지 정리',
    tags: ['nestjs'],
    contentHtml: `
<p>같은 요청 파이프라인 위에 살지만, 책임이 다르다.</p>
<h2>역할</h2>
<ul><li><strong>Guard</strong>: 통과 여부 결정(인증·권한). true / false 만 반환.</li><li><strong>Pipe</strong>: 입력 변환 + 검증(class-validator, ParseInt 등).</li><li><strong>Interceptor</strong>: 횡단 관심사(로깅, 캐시, 응답 매핑). before/after 모두 hook.</li></ul>
<p>"인증 후에 입력 검증" 이 자연스러운 순서다. Guard → Pipe → Handler → Interceptor.</p>`,
  },
  {
    title: 'IntersectionObserver 스크롤 스파이 — 함정 3가지',
    tags: ['web', 'javascript'],
    contentHtml: `
<p>구현은 쉽지만 회귀가 자주 난다.</p>
<h2>1. stale 노드</h2>
<p>본문 DOM 이 교체되면 IO 는 이전 노드를 계속 본다. MutationObserver 로 재등록하거나, scroll 핸들러 fallback 으로 보완한다.</p>
<h2>2. rootMargin 사각지대</h2>
<p><code>-70%</code> 같은 좁은 임계는 빠른 스크롤에서 콜백을 건너뛴다. 매 스크롤마다 직접 계산하는 fallback 이 안전.</p>
<h2>3. 클릭 점프와 동기화</h2>
<p>앵커 클릭 시 setActive 를 명시적으로 부르고, IO 가 곧 따라잡게 둔다.</p>`,
  },
  {
    title: 'pnpm workspace, 처음부터 다시 설계한다면',
    tags: ['pnpm', 'monorepo'],
    contentHtml: `
<p>패키지 경계는 도메인에 맞추고, 의존성 방향을 단방향으로 강제한다. <code>shared</code> 가 <code>api</code>·<code>web</code> 에서 import 되도록만 두고 반대는 막는다.</p>
<h2>실수했던 것</h2>
<ul><li>shared 에서 nest/zod/react 를 다 의존 → 트리 셰이킹 깨짐</li><li>workspace 안의 빌드 산출물(dist) 을 commit → CI 충돌</li><li>filter 명령을 외우려 함 — alias 로 정리하는 게 빠르다</li></ul>`,
  },
  {
    title: 'CSS sticky 가 동작하지 않는 흔한 이유',
    tags: ['css', 'web'],
    contentHtml: `
<p>스펙은 단순한데 부모 컨테이너가 함정이다.</p>
<h2>체크리스트</h2>
<ol><li>가장 가까운 스크롤 컨테이너가 sticky element 보다 충분히 길어야 한다</li><li>부모 어딘가에 <code>overflow: hidden</code> 이 있으면 거기가 컨텍스트가 된다</li><li>grid item 안에 sticky 를 두면 <code>align-items: start</code> 때문에 부모 높이가 콘텐츠 높이로 잡혀 무력화된다</li></ol>
<p>마지막 케이스는 sticky 를 grid item 자체로 올리고 <code>align-self: start</code> 를 주면 해결된다.</p>`,
  },
  {
    title: 'TanStack Query 의 staleTime vs gcTime',
    tags: ['react', 'tanstack-query'],
    contentHtml: `
<p>둘 다 캐시 동작을 제어하지만 의미가 다르다.</p>
<h2>staleTime</h2>
<p>이 시간 안에는 동일 쿼리가 신선하다고 보고 background refetch 를 하지 않는다. 기본 0 — 즉 어떤 동작이든 즉시 다시 가져온다.</p>
<h2>gcTime (구 cacheTime)</h2>
<p>구독자가 없을 때 캐시에 머무는 시간. 기본 5 분. 이 시간 후에 메모리에서 제거된다.</p>
<p>리스트 → 상세 패턴이라면 staleTime 을 30s 정도로 두고, 상세에서 리스트로 돌아갈 때 즉시 보이게 한다.</p>`,
  },
  {
    title: 'Zod 로 환경변수 안전하게 다루기',
    tags: ['typescript', 'zod'],
    contentHtml: `
<p>환경변수는 다 string 이라 잘못 쓰기 쉽다. boot 시점에 한 번 검증해서 다 끝낸다.</p>
<pre><code class="language-typescript">const Env = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().min(32),
});
export const env = Env.parse(process.env);
</code></pre>
<p>나머지 코드는 <code>env.PORT</code> 같은 좁은 타입만 사용한다. 검증 실패는 부팅 실패 — 운영 중에 터지는 것보다 낫다.</p>`,
  },
  {
    title: 'JWT 와 쿠키 세션, 어떤 걸 고르는가',
    tags: ['auth', 'security'],
    contentHtml: `
<p>"무엇이 더 좋은가" 보다 "무엇이 더 맞는가" 의 문제다.</p>
<h2>쿠키 세션</h2>
<p>서버에 상태가 있고, 즉시 폐기 가능. CSRF 방어가 필요하지만 XSS 노출은 적다(HttpOnly).</p>
<h2>JWT</h2>
<p>무상태 — 마이크로서비스/외부 클라이언트에 유리. 폐기가 어렵다(블랙리스트 또는 짧은 만료 + refresh 가 필수).</p>
<p>모놀리식 웹앱이면 쿠키 세션이 보통 더 단순하고 안전하다.</p>`,
  },
  {
    title: 'Playwright vs Cypress, 실전 차이',
    tags: ['testing', 'e2e'],
    contentHtml: `
<p>둘 다 좋은 도구지만 결이 다르다.</p>
<h2>Playwright</h2>
<ul><li>한 테스트에서 여러 탭/도메인 자유로움</li><li>auto-wait 이 더 영리</li><li>CI 병렬화가 기본</li></ul>
<h2>Cypress</h2>
<ul><li>대시보드 UX 가 직관적</li><li>플러그인 생태계가 풍부</li><li>도메인 간 이동에 제약이 있어 우회가 필요</li></ul>
<p>신규 프로젝트라면 Playwright 가 기본기를 깐다.</p>`,
  },
  {
    title: 'Vitest 가 Jest 를 대체할 수 있는 시점',
    tags: ['testing', 'vitest'],
    contentHtml: `
<p>Vite 기반 프로젝트는 거의 다 갈 수 있다.</p>
<h2>장점</h2>
<ul><li>같은 Vite 설정·플러그인을 그대로 사용</li><li>ESM 네이티브 — transformIgnorePatterns 의 늪이 없다</li><li>jest-compat API — 마이그레이션 비용이 낮다</li></ul>
<h2>주의</h2>
<p>Node ESM 의 mock 의미가 Jest 와 미묘하게 다르다. 동적 import + <code>vi.mock</code> 의 호이스팅 규칙을 한 번 정확히 익혀두자.</p>`,
  },
  {
    title: 'PostgreSQL EXPLAIN ANALYZE, 핵심 한 페이지',
    tags: ['postgres', 'performance'],
    contentHtml: `
<p>읽는 순서: 아래에서 위로, 안쪽에서 바깥쪽으로.</p>
<h2>볼 만한 지표</h2>
<ul><li><code>Seq Scan</code> + 큰 rows → 인덱스 누락 신호</li><li><code>Rows Removed by Filter</code> 가 크면 인덱스가 부분적으로만 매칭</li><li>예상 cost 와 실제 actual time 의 격차 → 통계 갱신(ANALYZE) 필요</li></ul>
<h2>팁</h2>
<p><code>EXPLAIN (ANALYZE, BUFFERS)</code> 로 디스크 vs 캐시 히트를 함께 본다. 첫 실행과 두 번째 실행의 차이가 인상적일 수 있다.</p>`,
  },
  {
    title: 'Prisma cuid 와 uuid, 어떤 걸 쓸까',
    tags: ['prisma', 'database'],
    contentHtml: `
<p>둘 다 충돌 없는 ID 지만 특성이 다르다.</p>
<h2>cuid</h2>
<ul><li>시간 기반 — 인덱스 위에서 순차적</li><li>URL 친화적 (영숫자만)</li><li>외부 노출에 부담이 적다</li></ul>
<h2>uuid</h2>
<ul><li>표준 — 모든 시스템이 알아본다</li><li>v7 부터 시간 정렬 가능</li><li>16바이트 binary 로 저장하면 인덱스가 빠르다</li></ul>
<p>내부 시스템 위주면 cuid, 외부 연동이 많으면 uuid 가 무난.</p>`,
  },
  {
    title: 'GitHub Actions matrix 빌드, 의존성 캐싱 정석',
    tags: ['ci', 'github-actions'],
    contentHtml: `
<p>매번 lockfile 해시로 키를 만들면 cache miss 가 너무 잦다.</p>
<h2>레이어 분리</h2>
<ol><li>node_modules 캐시 키: <code>os + node-version + lockfile-hash</code></li><li>빌드 결과 캐시 키: <code>os + commit-sha</code></li><li>restore-keys 로 fallback — lockfile 만 변해도 이전 캐시를 워밍 업한다</li></ol>
<p>matrix 안에서는 작업별로 키를 분리해야 다른 job 의 동시 write 와 충돌하지 않는다.</p>`,
  },
  {
    title: 'TypeScript const 어설션의 진짜 효용',
    tags: ['typescript'],
    contentHtml: `
<p><code>as const</code> 는 "이 값을 변하지 않을 리터럴로 좁혀라" 라는 신호다.</p>
<pre><code class="language-typescript">const STATUS = ['draft', 'published', 'archived'] as const;
type Status = typeof STATUS[number]; // 'draft' | 'published' | 'archived'
</code></pre>
<p>이 한 줄로 enum 없이도 타입과 런타임 값을 한 소스에서 관리할 수 있다.</p>`,
  },
  {
    title: 'React Hook 의 cleanup, 무엇이 언제 실행되나',
    tags: ['react'],
    contentHtml: `
<p><code>useEffect</code> 의 return 함수는 두 시점에 실행된다.</p>
<ul><li>다음 effect 가 실행되기 직전(deps 변경 시)</li><li>컴포넌트가 unmount 되기 직전</li></ul>
<p>StrictMode 의 dev 에서는 mount → cleanup → mount 가 한 번 더 도는 점도 잊지 말 것 — 이때 부수 효과가 누적되지 않게 cleanup 을 멱등하게 짠다.</p>`,
  },
  {
    title: 'Web Vitals INP 가 FID 를 대체한 배경',
    tags: ['performance', 'web-vitals'],
    contentHtml: `
<p>FID 는 "첫 입력 지연" 만 측정했다 — 그 후의 100 번의 인터랙션이 다 느려도 점수는 깨끗했다.</p>
<h2>INP 가 본질에 더 가깝다</h2>
<p>세션 동안 모든 인터랙션의 응답 시간 분포에서 98 퍼센타일을 본다. "한 번 빠르고 끝" 이 아니라 "꾸준히 빠른가" 를 측정.</p>
<p>최적화의 방향도 자연히 바뀐다 — 첫 로드 후 main thread 가 막히지 않게 chunk 분할과 task scheduler 가 더 중요해진다.</p>`,
  },
  {
    title: 'dangerouslySetInnerHTML 을 그래도 써야 한다면',
    tags: ['react', 'security'],
    contentHtml: `
<p>피할 수 있으면 피하지만, 마크다운/리치 콘텐츠 렌더링에선 어쩔 수 없다.</p>
<h2>최소한의 방어</h2>
<ul><li>입력 직후 sanitize — DOMPurify 등으로 화이트리스트 기반</li><li>같은 sanitizer 를 서버·클라이언트 양쪽에서 한 번씩(이중 방어)</li><li>CSP 로 inline script 차단 — 누가 sanitizer 를 우회해도 실행되지 않게</li></ul>
<p>의식적으로 라이프사이클 위에 두면 무서운 API 가 아니라 통제된 API 가 된다.</p>`,
  },
  {
    title: 'ESLint v9 flat config 로 옮긴 후기',
    tags: ['eslint', 'tooling'],
    contentHtml: `
<p><code>.eslintrc</code> 의 캐스케이드가 사라지고 단일 파일이 모든 걸 결정한다.</p>
<h2>좋은 점</h2>
<ul><li>config 가 평범한 JS — 디버깅이 쉽다</li><li>대상 파일 패턴이 명시적</li><li>플러그인 import 가 표준 ESM</li></ul>
<h2>옮길 때 주의</h2>
<p><code>extends</code> 대신 spread 와 적용 범위 객체를 합성한다. 익숙해지면 더 명료하지만 첫 마이그레이션은 한 번에 끝낸다.</p>`,
  },
  {
    title: 'Tailwind v4 의 @theme 와 토큰 전략',
    tags: ['tailwind', 'css'],
    contentHtml: `
<p>config 가 CSS 안으로 들어왔다. <code>@theme</code> 블록에 커스텀 속성을 선언하면 그게 그대로 디자인 토큰이 된다.</p>
<pre><code class="language-css">@theme {
  --color-accent: oklch(68% 0.21 250);
  --text-hero: clamp(3rem, 1rem + 7vw, 8rem);
}
</code></pre>
<p>JS 사이드 없이 디자인 시스템 일부가 일관되게 굴러간다. 큰 프로젝트는 토큰 파일을 별도 모듈로 두고 import 하는 게 깔끔.</p>`,
  },
  {
    title: 'ARIA live region 으로 상태 알림하기',
    tags: ['a11y', 'web'],
    contentHtml: `
<p>비주얼 토스트만으로는 스크린리더 사용자에게 안 닿는다.</p>
<h2>두 모드</h2>
<ul><li><code>aria-live="polite"</code> — 사용자가 멈춘 뒤 읽힘. 대부분의 알림에 적합.</li><li><code>aria-live="assertive"</code> — 즉시 끊고 읽힘. 오류·차단 메시지에만 한정.</li></ul>
<p>중요한 건 region 자체가 처음부터 DOM 에 존재해야 한다는 점. 알림 시점에 region 을 생성하면 일부 리더가 안 읽는다.</p>`,
  },
  {
    title: 'Nginx 리버스 프록시, 캐싱 한 줄 추가의 위력',
    tags: ['nginx', 'devops'],
    contentHtml: `
<p>정적 빌드 산출물은 immutable 해시가 붙어있다. 캐시를 최대로 둬도 안전.</p>
<pre><code class="language-nginx">location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}</code></pre>
<p>HTML 은 거꾸로 — <code>no-store</code> 또는 <code>max-age=0, must-revalidate</code> 로 두고 항상 최신 entry 가 해시 자산을 가리키게 한다.</p>`,
  },
  {
    title: 'Suspense 와 ErrorBoundary, 데이터 페칭의 한 묶음',
    tags: ['react'],
    contentHtml: `
<p>둘은 짝이다. Suspense 는 "기다림" 의 UI, ErrorBoundary 는 "실패" 의 UI 를 트리 안에서 선언적으로 둔다.</p>
<h2>구조</h2>
<pre><code class="language-tsx">&lt;ErrorBoundary fallback={&lt;Failed /&gt;}&gt;
  &lt;Suspense fallback={&lt;Skeleton /&gt;}&gt;
    &lt;Posts /&gt;
  &lt;/Suspense&gt;
&lt;/ErrorBoundary&gt;
</code></pre>
<p>boundary 의 위치가 곧 UX 의 단위 — 너무 위에 두면 페이지 전체가 깜빡이고, 너무 안에 두면 사용자가 어디서 실패했는지 모른다.</p>`,
  },
  {
    title: 'CSS color-mix() 가 디자인 변수에 어떻게 들어가는가',
    tags: ['css'],
    contentHtml: `
<p>두 색을 비율로 섞는다. 호버 톤·테두리·플레이스홀더에 특히 유용.</p>
<pre><code class="language-css">.button {
  background: var(--accent);
}
.button:hover {
  background: color-mix(in oklch, var(--accent) 88%, white);
}
</code></pre>
<p>토큰을 늘리지 않고도 일관된 톤 베리에이션이 가능하다. oklch 색공간을 쓰면 명도 변화가 시각적으로 균일.</p>`,
  },
  {
    title: 'SWC 가 Babel 을 대체할 만한 시점',
    tags: ['tooling', 'performance'],
    contentHtml: `
<p>JS 빌드의 가장 단순한 큰 승리.</p>
<h2>장점</h2>
<ul><li>Rust 구현 — 5~20× 빠른 트랜스파일</li><li>TypeScript 1급 지원</li><li>Next.js·Vite·Rspack 가 채택</li></ul>
<h2>아직 Babel 인 이유</h2>
<p>플러그인 생태계가 더 크다. 특정 변환(예: emotion, styled-components legacy) 은 아직 Babel 만 지원한다. 진단해서 갈 수 있는지 본다.</p>`,
  },
  {
    title: 'PostgreSQL JSONB, 인덱스를 빼먹지 않기',
    tags: ['postgres', 'database'],
    contentHtml: `
<p>JSONB 는 강력하지만 인덱스가 없으면 매 쿼리가 풀스캔.</p>
<h2>두 종류</h2>
<ul><li><code>GIN (data jsonb_path_ops)</code> — <code>@&gt;</code>(포함) 쿼리 위주</li><li>표현식 인덱스 — 특정 키 추출이 잦으면 <code>((data-&gt;&gt;'status'))</code></li></ul>
<p>EXPLAIN 으로 GIN 이 실제로 쓰이는지 확인 — 함수 호출이 끼면 인덱스를 못 쓴다.</p>`,
  },
  {
    title: 'React Server Components, 데이터 흐름 한 페이지',
    tags: ['react', 'next'],
    contentHtml: `
<p>RSC 는 서버에서 fetch → 직렬화 → 클라이언트 트리에 hydrate.</p>
<h2>경계 규칙</h2>
<ul><li>Server Component → 비동기 가능, hooks 불가</li><li>Client Component → <code>"use client"</code> 선언, hooks 가능</li><li>props 로 직렬화 가능한 값만 넘어간다 — 함수는 server action 으로만</li></ul>
<p>실수가 잦은 곳: client tree 안에 server-only 모듈 import. 빌드 시 친절하게 에러가 나지만 한 번은 꼭 만난다.</p>`,
  },
  {
    title: 'Vite 의 esbuild 디펜던시 prebundling 이해',
    tags: ['vite', 'tooling'],
    contentHtml: `
<p>처음 <code>pnpm dev</code> 가 잠깐 멈추는 이유 — Vite 가 <code>node_modules</code> 의존성을 esbuild 로 미리 묶어 ESM 단일 모듈로 만든다.</p>
<h2>이걸 알면 좋은 점</h2>
<ul><li><code>optimizeDeps.include</code> 로 자주 import 하는 모듈을 미리 prebundle</li><li>버전이 바뀌면 자동 재빌드되지만, 캐시(<code>.vite</code>) 가 꼬이면 수동 삭제</li><li>SSR 빌드는 별도 — node 빌트인을 external 로 두는 게 보통 정답</li></ul>`,
  },
];

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL 이 필요합니다.');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const author = await prisma.user.findUnique({
      where: { email: AUTHOR_EMAIL },
    });
    if (!author) {
      throw new Error(`작성자 ${AUTHOR_EMAIL} 를 찾을 수 없습니다.`);
    }

    const now = Date.now();
    const spanMs = 60 * 24 * 3600 * 1000; // 최근 60일에 분산
    const total = POSTS.length;

    let created = 0;
    for (let i = 0; i < total; i++) {
      const p = POSTS[i];

      const base = slugify(p.title);
      let slug = base;
      let n = 1;
      // 동일 slug 가 이미 있으면 -2, -3 … 으로 회피
      while (await prisma.post.findUnique({ where: { slug } })) {
        n += 1;
        slug = `${base}-${n}`;
      }

      const offsetMs = Math.round(((total - 1 - i) / (total - 1)) * spanMs);
      const publishedAt = new Date(now - offsetMs);

      await prisma.post.create({
        data: {
          slug,
          title: p.title,
          contentMarkdown: '',
          contentHtml: p.contentHtml.trim(),
          status: 'PUBLISHED',
          publishedAt,
          authorId: author.id,
          postTags: {
            create: p.tags.map((name) => ({
              tag: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          },
        },
      });
      created += 1;
    }

    console.log(`✓ ${created} posts created for ${AUTHOR_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
