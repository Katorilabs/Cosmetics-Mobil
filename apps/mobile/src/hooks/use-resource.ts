import { useCallback, useEffect, useRef, useState } from 'react';

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const loader = useRef(load);
  loader.current = load;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: Error; loading: boolean }>({ key, loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loading: true });
    loader.current(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data, loading: false }); },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error : new Error('Bir hata oluştu.'), loading: false }); },
    );
    return () => controller.abort();
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  // Never show another product/search/variant's data during the render before effect cleanup.
  return { ...(state.key === key ? state : { key, loading: true }), retry };
}
