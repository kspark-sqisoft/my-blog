import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('delay 경과 전에는 이전 값을 유지하고, 경과 후 새 값으로 바뀐다', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: 'a' } },
    );
    expect(result.current).toBe('a');

    rerender({ v: 'ab' });
    expect(result.current).toBe('a'); // 아직 디바운스 중

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab'); // 300ms 경과 → 반영
  });

  it('연속 변경 시 마지막 값만 반영한다(중간값 스킵)', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: '' } },
    );
    rerender({ v: 'n' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'ne' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'nest' });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe(''); // 매 변경이 타이머를 리셋
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('nest');
  });
});
