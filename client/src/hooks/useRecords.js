import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export function useRecords(filters = {}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getRecords(filters);
      setRecords(result.records || []);
      setPagination({ 
        total: result.total, 
        page: result.page, 
        totalPages: Math.ceil(result.total / (result.limit || 20))
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const refresh = useCallback(() => fetchRecords(), [fetchRecords]);

  return { records, loading, error, pagination, refresh };
}
