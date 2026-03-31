import { useState, useEffect, useCallback } from 'react';

interface UseDataOptions<T> {
  fetcher: () => Promise<T>;
  defaultValue: T;
  deps?: React.DependencyList;
  immediate?: boolean;
}

interface UseDataResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useData<T>(options: UseDataOptions<T>): UseDataResult<T> {
  const { fetcher, defaultValue, deps = [], immediate = true } = options;
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, deps);

  return { data, loading, error, refresh };
}
