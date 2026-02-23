import { useEffect, useRef, useCallback } from 'react';

export function useDebounce(fn, delay) {
  const timer = useRef(null);

  const debounced = useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  return debounced;
}
