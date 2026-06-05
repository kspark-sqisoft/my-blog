// Vitest 전역 setup: jest-dom 매처(toBeInTheDocument 등) 등록
import '@testing-library/jest-dom/vitest';

// jsdom 에는 IntersectionObserver 가 없다. 이를 사용하는 컴포넌트(ArticleToc 등)가
// 크래시하지 않도록 no-op 스텁을 둔다. 동작 검증이 필요한 테스트는 vi.stubGlobal 로 덮어쓴다.
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
