import { useEffect, useState } from 'react';
import api from '../services/api';

export function useApiData(endpoint, fallback = []) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await api.get(endpoint);
        if (!isMounted) return;
        setData(response.data?.data ?? response.data);
      } catch (err) {
        if (!isMounted) return;
        setError(err);
        setData(fallback);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [endpoint, JSON.stringify(fallback)]);

  return { data, loading, error };
}
