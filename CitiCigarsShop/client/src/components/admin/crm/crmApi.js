import { API_URL } from '@/config';

export function crmFetch(path, options = {}) {
  const token = sessionStorage.getItem('cms_token');
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-cms-token': token || '',
      ...(options.headers || {}),
    },
  });
}
