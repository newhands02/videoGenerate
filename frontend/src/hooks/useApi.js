import { useState, useCallback } from 'react';

const BASE = 'http://localhost:8000';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'Accept': 'application/json', ...options.headers },
        ...options,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createJob = useCallback(async (text, title, file) => {
    const form = new FormData();
    form.append('title', title || 'Untitled');
    form.append('text', text || '');
    if (file) form.append('file', file);
    return request('/api/jobs', { method: 'POST', body: form, headers: {} });
  }, [request]);

  const listJobs = useCallback(() => request('/api/jobs'), [request]);
  const getJob = useCallback((id) => request(`/api/jobs/${id}`), [request]);
  const deleteJob = useCallback((id) => request(`/api/jobs/${id}`, { method: 'DELETE' }), [request]);
  const retryJob = useCallback((id) => request(`/api/jobs/${id}/retry`, { method: 'POST' }), [request]);

  return { loading, error, createJob, listJobs, getJob, deleteJob, retryJob, BASE };
}
