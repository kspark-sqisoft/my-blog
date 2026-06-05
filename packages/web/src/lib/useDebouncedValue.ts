import { useEffect, useState } from 'react';

// 값이 delay(ms) 동안 더 바뀌지 않으면 그 값을 반환한다(디바운스).
// 검색 입력처럼 타이핑 중 매 키마다 호출하지 않으려 할 때 사용.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
